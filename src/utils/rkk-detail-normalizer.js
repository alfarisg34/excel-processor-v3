
const ExcelJS=require('exceljs');
const {getCellText}=require('./excel-helpers');
const {level,tree}=require('./budget-hierarchy');
function number(text) {
  if(text===null || text===undefined || String(text).trim()==='')return null;
  const value=Number(String(text).trim());
  return Number.isFinite(value)?value:null;
}
function footer(cells) {
  if(!cells.slice(0,5).some(c=>['-','>','>>'].includes(c)) && cells.some(c=>/^(TAHUN(?: ANGGARAN)?|TA|SATKER|SATUAN KERJA|KODE SATKER|KEMENTERIAN(?: NEGARA)?(?:\/LEMBAGA)?)(?:\s*:|\s*$)/i.test(c)))return true;
  if(cells.slice(0,5).some(c=>['-','>','>>'].includes(c)) || level(cells[0]||cells[1]||cells[2])!==99)return false;
  const text=cells.join(' ').trim();
  return /catatan\s*:|\bNIP\s*\d{8}|\bKPPN[.\s(]|^Lokasi\s*:|^\d+\.\s*[*UP]\s*=|Jakarta.*\d+\s+[A-Za-z]+\s+\d{4}/i.test(text);
}
function readRows(ws) {
  const rows=[];let tagging='RM';
  for(let r=1;r<=ws.rowCount;r++) {
    const cells=Array.from({length:25},(_,i)=>getCellText(ws.getRow(r).getCell(i+1)).trim());
    if(!cells.some(Boolean)||footer(cells))continue;
    let code=cells[0]||cells[1]||cells[2],uraian=cells[3]||cells[4]||cells[5]||'';
    const marker=[code,cells[3]].find(c=>['-','>','>>'].includes(c));
    if(marker){code=marker;uraian=(cells[4]||cells[5]||'').replace(/^(>>|>|-)\s*/,'');}
    else if(!code && /^(>>|>|-)\s*/.test(cells[4])) {
      const m=cells[4].match(/^(>>|>|-)\s*/);code=m[1];uraian=cells[4].slice(m[0].length);
    }
    const explicit=cells.slice(8,17).find(c=>/^(RM|PNP|PNBP|PLN|PHLN)$/i.test(c));
    const normTag=explicit?explicit.toUpperCase().replace(/^PNP$/,'PNBP').replace(/^PHLN$/,'PLN'):null;
    if(level(code)===7)tagging=normTag||'RM';
    rows.push({rowNum:r,sourceRows:ws.getRow(r).rkkSourceRows||[r],cells,code,uraian,tagging:normTag||tagging,
      amount:number(cells[9])??number(cells[10]),volume:cells[6],price:number(cells[7]),
      block:cells.slice(10,17).filter(c=>c==='*'||c==='RK').join('|')});
  }
  return rows;
}
function bracket(s) {
  s=s.replace(/\s*\(KPPN[^)]*\)\s*/gi,' ').trim();
  const m=s.match(/\[([^\]]+)\]\s*$/);if(!m)return null;
  const parts=m[1].split(/\s*[x×]\s*/i), nums=parts.map(p=>Number((p.trim().match(/^\d+(?:\.\d+)?/)||[])[0]));
  return nums.length && nums.every(Number.isFinite)?nums.reduce((a,b)=>a*b,1):null;
}
function totalLeaves(n){return n.level===10?(n.amount||0):n.children.reduce((s,c)=>s+totalLeaves(c),0);}
function normalize(ws) {
  if(ws.rkkNormalization)return ws.rkkNormalization;
  const rows=readRows(ws), findings=[], issues=[];
  const compatible=(a,b)=>a.tagging===b.tagging && a.block===b.block &&
    ['amount','price','volume'].every(k=>a[k]===null||a[k]===''||b[k]===null||b[k]===''||a[k]===b[k]);
  let built=tree(rows);const nodeByRow=new Map(built.nodes.map(n=>[n.rowNum,n]));
  for(let i=0;i<rows.length;i++) {
    const a=rows[i];if(level(a.code)===99)continue;
    const chain=[a];let combined=a.uraian;
    for(let j=i+1;j<rows.length && chain.length<12;j++) {
      const b=rows[j], prev=chain[chain.length-1];
      if(b.rowNum!==prev.rowNum+1 || (b.code && b.code!==a.code) || !compatible(a,b))break;
      if(a.code==='-' && bracket(combined)!==null)break;
      if(!b.code && (b.amount!==null||b.price!==null))break;
      if(!b.uraian)break;
      chain.push(b);combined+=' '+b.uraian;
      let proven=false;
      if(!b.code)proven= b.amount===null && b.price===null;
      else if(level(a.code)<=7) {
        const na=nodeByRow.get(a.rowNum),nb=nodeByRow.get(b.rowNum);
        proven=na && nb && na.parent===nb.parent && !na.children.length && nb.children.length && a.uraian!==b.uraian && (a.amount===null || b.amount===null || a.amount===b.amount);
      } else if(a.code==='>'||a.code==='>>') {
        const na=nodeByRow.get(a.rowNum),nb=nodeByRow.get(b.rowNum);
        proven=na && nb && na.parent===nb.parent && !na.children.length && nb.children.length &&
          a.amount!==null && a.amount===b.amount && totalLeaves(nb)===a.amount;
      } else if(a.code==='-') {
        const product=bracket(combined),vol=Number((a.volume.match(/^\d+(?:\.\d+)?/)||[])[0]);
        const na=nodeByRow.get(a.rowNum),nb=nodeByRow.get(b.rowNum);
        const parent=na?.parent;
        const siblings=parent?.children||[];
        const similar=siblings.filter((n,k)=>n.level===10 && bracket(n.uraian)===null &&
          siblings[k+1]?.level===10 && bracket(siblings[k+1].uraian)!==null &&
          n.amount===siblings[k+1].amount);
        proven=product!==null && (Number.isNaN(vol)||product===vol) && na?.parent===nb?.parent &&
          a.amount!==null && a.amount===b.amount && parent?.amount!==null &&
          totalLeaves(parent)-a.amount*(chain.length-1)===parent.amount && similar.length<=1;
        if(a.amount===null && a.price===null && !a.volume && product!==null && b.amount!==null && na?.parent===nb?.parent)proven=true;
        if(product!==null&&!proven) {
          issues.push({type:'REVIEW_REQUIRED',sourceRows:chain.flatMap(x=>x.sourceRows),message:'Kemungkinan uraian detail terpisah; bukti subtotal/angka belum cukup untuk menggabungkan.'});
          break;
        }
      }
      if(!proven) {
        if((a.code==='-' && bracket(combined)===null) || (level(a.code)<10 && nodeByRow.get(b.rowNum)?.children.length===0))continue;
        break;
      }
      a.uraian=combined.replace(/\s+/g,' ').trim();
      for(const k of ['amount','price','volume'])if(a[k]===null||a[k]==='')a[k]=b[k];
      a.sourceRows=chain.flatMap(x=>x.sourceRows);
      a.cells[4]=a.uraian;a.cells[5]='';
      if(!['-','>','>>'].includes(a.code)){a.cells[3]=a.uraian;a.cells[4]='';}
      if(a.amount!==null)a.cells[9]=String(a.amount);
      if(a.price!==null)a.cells[7]=String(a.price);
      a.cells[6]=a.volume;
      for(const consumed of chain.slice(1)){consumed.consumed=true;}
      findings.push({type:'NORMALIZED_CONTINUATION',sourceRows:[...a.sourceRows],code:a.code,uraian:a.uraian,amount:a.amount,
        message:'Uraian beberapa baris digabung; nilai berulang dihitung satu kali.'});
      i=j;break;
    }
  }
  for(const r of rows)if(!r.consumed && r.code==='-' && r.uraian.includes('[') && bracket(r.uraian)===null){
    const recovered=bracket(r.uraian+']'),volume=Number((r.volume.match(/^\d+(?:\.\d+)?/)||[])[0]);
    if(!r.uraian.includes(']') && recovered!==null && recovered===volume && r.price!==null && volume*r.price===r.amount){r.uraian+=']';r.cells[4]=r.uraian;r.cells[5]='';findings.push({type:'RECOVERED_BRACKET',code:r.code,sourceRows:r.sourceRows,uraian:r.uraian,amount:r.amount,message:'Bracket penutup dipulihkan; perkalian, volume, harga, dan jumlah sumber sesuai.'});}
    else issues.push({type:'INCOMPLETE_BRACKET',sourceRows:r.sourceRows,message:'Rincian bracket belum lengkap atau tidak dapat diparsing; tinjau kelanjutan uraian.'});
  }
  const logical=rows.filter(r=>!r.consumed);
  const final=tree(logical);
  const reconciliation=[],warnings=[],leafSignatures=new Map();
  const seen=new Map();
  for(const n of final.nodes) {
    if(n.level>=2 && n.level<=7 && n.parent.level!==n.level-1)issues.push({type:'MISSING_PARENT',sourceRows:n.sourceRows,code:n.code,message:'Parent hirarki tidak lengkap untuk kode '+n.code+'.'});
    if(n.level===10) {
      const signature=JSON.stringify([n.parent.rowNum,n.uraian,n.amount,n.price,n.volume,n.tagging,n.block]);
      if(leafSignatures.has(signature))warnings.push({type:'POSSIBLE_DUPLICATE_DETAIL',sourceRows:[...leafSignatures.get(signature),...n.sourceRows],message:'Detail lengkap identik berulang; dipertahankan sebagai item terpisah, tinjau apakah keduanya memang sah.'});else leafSignatures.set(signature,n.sourceRows);
      const calculationVolume=bracket(n.uraian)??Number((n.volume.match(/^\d+(?:\.\d+)?/)||[])[0]);
      if(Number.isFinite(calculationVolume) && n.price!==null && n.amount!==null && calculationVolume*n.price!==n.amount)warnings.push({type:'DETAIL_CALCULATION_DIFFERENCE',sourceRows:n.sourceRows,expected:n.amount,actual:calculationVolume*n.price,difference:calculationVolume*n.price-n.amount,message:'Jumlah sumber berbeda dari volume × harga; periksa kebijakan pembulatan. Selisih '+(calculationVolume*n.price-n.amount)+'.'});
      if(n.amount===null)issues.push({type:'INVALID_AMOUNT',sourceRows:n.sourceRows,message:'Jumlah detail kosong atau bukan angka.'});
      if(n.parent.level<7)issues.push({type:'MISSING_PARENT',sourceRows:n.sourceRows,message:'Detail tidak mempunyai konteks akun.'});
      continue;
    }
    if(n.level<=7) {
      const key=n.parent.path+'|'+n.code+'|'+(n.level===7?n.tagging:'');
      if(seen.has(key))issues.push({type:'DUPLICATE_HEADER',sourceRows:[...seen.get(key),...n.sourceRows],message:'Header lengkap berulang dalam parent dan sumber dana yang sama.'});
      else seen.set(key,n.sourceRows);
    }
    if(!n.children.length && n.amount!==null && n.amount!==0)
      issues.push({type:'EMPTY_GROUP',sourceRows:n.sourceRows,code:n.code,message:'Subtotal nonnol tidak mempunyai anak; kemungkinan uraian terpisah.'});
    if(n.amount!==null && n.children.length) {
      const actual=totalLeaves(n);
      if(actual!==n.amount)reconciliation.push({cell:(number(n.cells[9])!==null?'J':'K')+n.rowNum,code:n.code,level:n.level,
        fullPath:n.path,sourceRows:n.sourceRows,expected:n.amount,actual,difference:actual-n.amount});
    }
  }
  for(const n of logical)if(level(n.code)===99 && (n.amount!==null || (!n.code && n.uraian)))issues.push({type:'UNCLASSIFIED_ROW',sourceRows:n.sourceRows,message:'Baris uraian belum dapat dipasangkan dengan entitas anggaran; perbaiki sumber sebelum memproses.'});
  const audit={rows:logical,findings,issues,warnings,reconciliation,validationComplete:!issues.length};
  ws.rkkNormalization=audit;return audit;
}
function normalizedWorksheet(ws) {
  const audit=normalize(ws),book=new ExcelJS.Workbook(),copy=book.addWorksheet(ws.name);
  ws.eachRow(row=>{copy.getRow(row.number).values=Array.from({length:25},(_,i)=>getCellText(row.getCell(i+1)));});
  for(const row of readRows(ws))copy.getRow(row.rowNum).values=[];
  for(const row of audit.rows) {
    copy.getRow(row.rowNum).values=row.cells;
    copy.getRow(row.rowNum).rkkSourceRows=row.sourceRows;
  }
  copy.rkkNormalization=audit;return copy;
}
function applyNormalized(ws) {
  const copy=normalizedWorksheet(ws);
  for(let r=1;r<=ws.rowCount;r++) {
    ws.getRow(r).values=copy.getRow(r).values.slice(1);
    ws.getRow(r).rkkSourceRows=copy.getRow(r).rkkSourceRows;
  }
  ws.rkkNormalization=copy.rkkNormalization;return ws;
}
module.exports={readRows,normalize,normalizedWorksheet,applyNormalized,number,totalLeaves};
