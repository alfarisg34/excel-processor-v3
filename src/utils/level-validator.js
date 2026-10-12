
const ExcelJS=require('exceljs');
const {getCellText}=require('./excel-helpers');
const {normalize}=require('./rkk-detail-normalizer');
const {level}=require('./budget-hierarchy');
const {createEvaluator}=require('./formula-evaluator');
const clean=s=>String(s||'').replace(/\s*\[.*$/,'').replace(/\s+/g,' ').trim().toLowerCase();
function describe(rows) {
  const stack=[],counts=new Map();
  return rows.filter(r=>level(r.code)!==99).map(r=>{
    const depth=level(r.code);
    while(stack.length && stack[stack.length-1].level>=depth)stack.pop();
    const parent=stack[stack.length-1], component=depth>=8?clean(r.uraian):r.code;
    const base=(parent?.key||'')+'|'+component+(depth>=7?'|'+r.tagging:'');
    const occurrence=(counts.get(base)||0)+1;counts.set(base,occurrence);
    const node={...r,level:depth,key:depth===10?base:base+'#'+occurrence,parentKey:parent?.key||'',fullCodePath:stack.map(n=>n.code+(n.level>=8?' '+n.uraian:'')).concat(r.code).join(' > ')};
    stack.push(node);return node;
  });
}
async function validate(input, output) {
  if(Buffer.isBuffer(input)){const book=new ExcelJS.Workbook();await book.xlsx.load(input);input=book;}
  const allDetails=[],subtotals=[],diagnostics=[],findings=[],sourceIssues=[],sourceReconciliation=[],sourceWarnings=[];
  let detailBefore=0,detailAfter=0,rawBefore=0,totalBudgetBefore=0,totalBudgetAfter=0;
  for(const wsI of input.worksheets) {
    const audit=normalize(wsI);findings.push(...audit.findings.map(f=>({...f,sheetName:wsI.name})));
    sourceWarnings.push(...audit.warnings.map(f=>({...f,sheetName:wsI.name})));
    sourceIssues.push(...audit.issues.map(f=>({...f,sheetName:wsI.name})));
    sourceReconciliation.push(...audit.reconciliation.map(f=>({...f,sheetName:wsI.name})));
    const source=describe(audit.rows);detailBefore+=source.filter(n=>n.level===10).reduce((sum,n)=>sum+(n.amount||0),0);
    const wsO=output.getWorksheet(wsI.name);
    for(const n of source)if(n.level===1 && n.amount!==null)totalBudgetBefore+=n.amount;
    if(!wsO){diagnostics.push({sheetName:wsI.name,type:'MISSING_SHEET',message:'Sheet output tidak ditemukan.'});}
    const outRows=[];let tag='RM';
    if(wsO)for(let r=4;r<=wsO.rowCount;r++) {
      const row=wsO.getRow(r),code=getCellText(row.getCell(1));if(level(code)===99)continue;
      const own=getCellText(row.getCell(20));if(level(code)===7)tag=own||'RM';
      outRows.push({rowNum:r,code,uraian:getCellText(row.getCell(2)),tagging:tag.replace(/^PNP$/,'PNBP').replace(/^PHLN$/,'PLN'),sourceRows:row.rkkSourceRows});
    }
    const outs=describe(outRows),evaluate=wsO?createEvaluator(wsO):null;
    const numeric=n=>{try{const v=evaluate.cell('S'+n.rowNum);if(v===null)throw Error('EMPTY_AMOUNT');return v;}
      catch(e){diagnostics.push({sheetName:wsI.name,outRowNum:n.rowNum,type:'EVALUATION_ERROR',message:e.message});return null;}};
    for(const n of outs)n.value=numeric(n);
    const expectedLeafSum=(nodes,index)=>{let sum=0;for(let j=index+1;j<nodes.length && nodes[j].level>nodes[index].level;j++)
      if(nodes[j].level===10){if(nodes[j].value===null)return null;sum+=nodes[j].value;}return sum;};
    const inputBuckets=new Map();
    source.forEach(n=>{const key=n.key;if(!inputBuckets.has(key))inputBuckets.set(key,[]);inputBuckets.get(key).push(n);});
    const unresolved=new Set(),consumed=new Set(),lineageIndex=new Map(source.map(n=>[n.sourceRows[0],n]));
    for(let i=0;i<outs.length;i++) {
      const n=outs[i],origin=lineageIndex.get(n.sourceRows?.[0]);
      const pool=(inputBuckets.get(n.key)||[]).filter(x=>!consumed.has(x));
      const ambiguous=!origin && n.level===10 && pool.length>1 && new Set(pool.map(x=>JSON.stringify([x.amount,x.price,x.volume,x.block]))).size>1;
      if(ambiguous){pool.forEach(x=>unresolved.add(x));diagnostics.push({type:'AMBIGUOUS_MATCH',sheetName:wsI.name,outRowNum:n.rowNum,sourceRows:pool.flatMap(x=>x.sourceRows),message:'Beberapa detail beruraian sama memiliki angka berbeda; pasangan tidak dapat dipastikan tanpa provenance.'});}
      const inN=origin && origin.level===n.level && origin.code===n.code && origin.tagging===n.tagging && !consumed.has(origin)?origin:ambiguous?null:pool[0];
      if(inN)consumed.add(inN);
      const before=inN?.amount??null,after=n.value;
      const diff=before!==null&&after!==null?Math.round(after-before):null;
      const status=!inN?(ambiguous?'INCOMPLETE':'ADDED'):after===null?'INCOMPLETE':before===null?(n.level===10?'INCOMPLETE':'MATCH'):diff===0?'MATCH':'DIFF';
      const item={sheetName:wsI.name,outRowNum:n.rowNum,rawRowNum:inN?.rowNum||'-',sourceRows:inN?.sourceRows||[],
        fullCodePath:n.fullCodePath,level:n.level,code:n.code,uraian:n.uraian,tagging:n.tagging,valBefore:before,valAfter:after,sourceComparison:before===null?'NOT_AVAILABLE':'AVAILABLE',diff,status};
      if(n.level===10){allDetails.push(item);if(after!==null)detailAfter+=after;}
      else {
        const leafTotal=expectedLeafSum(outs,i);
        subtotals.push({...item,before,after,leafTotal,formulaDifference:after!==null&&leafTotal!==null?Math.round(after-leafTotal):null,
          sourceComparison:before===null?'NOT_AVAILABLE':'AVAILABLE',
          status:status!=='MATCH'?status:(after!==leafTotal?'DIFF':'MATCH')});
        if(n.level===1 && after!==null)totalBudgetAfter+=after;
      }
    }
    for(const n of source)if(!consumed.has(n)) {
      const item={sheetName:wsI.name,rawRowNum:n.rowNum,sourceRows:n.sourceRows,outRowNum:null,level:n.level,code:n.code,
        uraian:n.uraian,tagging:n.tagging,fullCodePath:n.fullCodePath,valBefore:n.amount,valAfter:null,diff:null,status:unresolved.has(n)?'INCOMPLETE':'MISSING'};
      if(n.level===10){allDetails.push(item);}
      else subtotals.push({...item,before:n.amount,after:null});
    }
    for(const row of require('./rkk-detail-normalizer').readRows(wsI))if(row.code==='-')rawBefore+=row.amount||0;
  }
  for(const sheet of output.worksheets)if(!input.getWorksheet(sheet.name))diagnostics.push({type:'ADDED_SHEET',sheetName:sheet.name,message:'Sheet output tambahan tidak mempunyai sumber.'});
  const differences=allDetails.filter(x=>x.status!=='MATCH'),nodeDiff=subtotals.filter(x=>x.status!=='MATCH');
  const validationComplete=diagnostics.length===0 && sourceIssues.length===0 && !allDetails.some(x=>x.status==='INCOMPLETE');
  const hasDifference=differences.some(x=>x.status!=='INCOMPLETE') || nodeDiff.some(x=>x.status!=='INCOMPLETE') || sourceReconciliation.length>0;
  const programSummary=subtotals.filter(x=>x.level===1);
  const report={schemaVersion:2,totalItemsCount:allDetails.length,matchCount:allDetails.filter(x=>x.status==='MATCH').length,diffCount:differences.length,
    totalBefore:detailBefore,totalAfter:detailAfter,totalDiff:Math.round(detailAfter-detailBefore),rawDetailBefore:rawBefore,
    totalBudgetBefore,totalBudgetAfter,totalBudgetDiff:Math.round(totalBudgetAfter-totalBudgetBefore),
    absoluteDetailDiff:differences.reduce((s,x)=>s+Math.abs(x.diff||0),0),
    missingCount:differences.filter(x=>x.status==='MISSING').length,addedCount:differences.filter(x=>x.status==='ADDED').length,
    normalizationCount:findings.length,structuralIssueCount:sourceIssues.length,sourceMismatchCount:sourceReconciliation.length,diagnosticCount:diagnostics.length,
    subtotalDiffCount:nodeDiff.length,programDiffCount:programSummary.filter(x=>x.status!=='MATCH').length,validationComplete,
    overallStatus:hasDifference?'DIFF':validationComplete?'MATCH':'INCOMPLETE',programSummary,sourceIssues,sourceReconciliation,normalizationFindings:findings,
    sourceWarnings,diagnostics,subtotalDiscrepancies:nodeDiff,discrepancyItems:differences.sort((a,b)=>Math.abs(b.diff||0)-Math.abs(a.diff||0)),sampleAllItems:allDetails.slice(0,30)};
  return report;
}
function compact(report) {
  return {...report,sourceWarnings:report.sourceWarnings?.slice(0,3)||[],programSummary:report.programSummary.slice(0,10),sourceIssues:report.sourceIssues.slice(0,3),
    sourceReconciliation:report.sourceReconciliation.slice(0,3),normalizationFindings:report.normalizationFindings.slice(0,5),
    diagnostics:report.diagnostics.slice(0,3),subtotalDiscrepancies:report.subtotalDiscrepancies.slice(0,3),
    discrepancyItems:report.discrepancyItems.slice(0,5),sampleAllItems:report.sampleAllItems.slice(0,3),
    displayedDetailCount:Math.min(5,report.discrepancyItems.length),completeReportAvailable:true};
}
module.exports=validate;
module.exports.compact=compact;
