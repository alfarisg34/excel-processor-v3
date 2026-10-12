
const assert=require('assert/strict');
const ExcelJS=require('exceljs');
const fs=require('fs/promises');
const path=require('path');
const {normalize}=require('../src/utils/rkk-detail-normalizer');
const {processExcel}=require('../src/processor');
const validate=require('../src/utils/level-validator');
const {createEvaluator}=require('../src/utils/formula-evaluator');
const {applySums}=require('../src/utils/budget-hierarchy');
const batch=require('../src/utils/hierarchy-recap-batch');
function fixture(details,total) {
  const book=new ExcelJS.Workbook(),ws=book.addWorksheet('RKK');
  for(const [code,name] of [['026.04.WA','Program'],['6621','Kegiatan'],['6621.EBA','KRO'],['6621.EBA.001','RO'],['051','Komponen'],['A','Subkomponen'],['524111','Akun']]) {
    const row=ws.addRow([]);row.getCell(1).value=code;row.getCell(4).value=name;row.getCell(10).value=total;
    if(code==='524111')row.getCell(12).value='RM';
  }
  for(const item of details) {
    const row=ws.addRow([]);row.getCell(4).value=item.code??'-';row.getCell(5).value=item.text;
    if(item.amount!==undefined)row.getCell(10).value=item.amount;
    if(item.vol!==undefined)row.getCell(7).value=item.vol;
    if(item.price!==undefined)row.getCell(8).value=item.price;
  }
  return book;
}
async function run() {
  const repeated=(text)=>({text,amount:16,vol:'16 OH',price:1});
  let book=fixture([{code:'>',text:'Kelompok',amount:16},repeated('Uraian terpisah'),repeated('Bagian kedua'),repeated('Bagian akhir [8 ORG x 2 HR x 1 LKS]')],16);
  let audit=normalize(book.worksheets[0]);
  assert.equal(audit.rows.filter(r=>r.code==='-').length,1);
  assert.deepEqual(audit.findings[0].sourceRows,[9,10,11]);
  assert.equal(audit.reconciliation.length,0);
  book=fixture([{code:'>',text:'Grup awal',amount:16},{code:'>',text:'Grup tengah',amount:16},{code:'>',text:'Grup akhir',amount:16},repeated('Detail [16 OH]')],16);
  audit=normalize(book.worksheets[0]);assert.equal(audit.rows.filter(r=>r.code==='>').length,1);
  assert.deepEqual(audit.findings[0].sourceRows,[8,9,10]);
  book=fixture([repeated('Item satu [16 OH]'),repeated('Item dua [16 OH]')],32);
  assert.equal(normalize(book.worksheets[0]).findings.length,0);
  const kppnDetail=normalize(fixture([{text:'Transport [2 ORG] (KPPN.182)',amount:2,vol:'2 OT',price:1}],2).worksheets[0]);assert.equal(kppnDetail.issues.length,0);
  const recovered=normalize(fixture([{text:'Uang Harian [1 ORG x 2 HR x 3 KL x 10 BLN',amount:12600000,vol:'60 OH',price:210000}],12600000).worksheets[0]);
  assert.equal(recovered.issues.length,0);assert.equal(recovered.findings[0].type,'RECOVERED_BRACKET');
  book=fixture([{text:'Uraian tanpa bracket',amount:10,vol:'10 OH',price:1}],10);
  assert.equal(normalize(book.worksheets[0]).rows.filter(r=>r.code==='-').length,1);
  book=fixture([{code:'>',text:'Grup',amount:16},repeated('Potongan'),{text:'Akhir [16 OH]',amount:17,vol:'16 OH',price:1}],33);
  assert.equal(normalize(book.worksheets[0]).findings.length,0);
  book=fixture([{code:'>',text:'Awal grup',amount:16},{code:'>',text:'Akhir grup',amount:16},repeated('Detail [16 OH]')],16);
  const buffer=await book.xlsx.writeBuffer();
  const output=await processExcel(buffer);
  let report=await validate(buffer,output);
  assert.equal(report.overallStatus,'MATCH');
  assert.equal(report.totalBudgetDiff,0);
  assert.equal(report.normalizationFindings.length,1);
  const ws=output.worksheets[0],evalOut=createEvaluator(ws);
  const accountRow=Array.from({length:ws.rowCount},(_,i)=>i+1).find(r=>ws.getCell('A'+r).value==='524111');
  assert.equal(evalOut.cell('S'+accountRow),16);

  // A mixed tree: direct leaf + > with direct leaf + >>.
  const mixed=new ExcelJS.Workbook(),m=mixed.addWorksheet('mix');
  ['524111','-','>','-','>>','-','>','-'].forEach((code,i)=>{m.getCell('A'+(i+1)).value=code;});
  for(const r of [2,4,6,8])for(const c of ['S','AM','AP','AQ'])m.getCell(c+r).value=r;
  applySums(m,['S','AM','AP','AQ']);
  const ev=createEvaluator(m);
  for(const c of ['S','AM','AP','AQ'])assert.equal(ev.cell(c+'1'),20);
  assert.equal(m.getCell('S1').formula,'SUM(S2,S3,S7)');
  assert.equal(m.getCell('S3').formula,'SUM(S4,S5)');

  const identical=normalize(fixture([repeated('Sama [16 OH]'),repeated('Sama [16 OH]')],32).worksheets[0]);
  assert.equal(identical.rows.filter(r=>r.code==='-').length,2);assert.equal(identical.warnings.length,1);assert.equal(identical.issues.length,0);
  const ambiguousSource=fixture([{code:'>',text:'Grup',amount:32},repeated('Potongan'),repeated('Akhir [16 OH]')],32);
  assert(normalize(ambiguousSource.worksheets[0]).issues.some(x=>x.type==='REVIEW_REQUIRED'));
  await assert.rejects(processExcel(await ambiguousSource.xlsx.writeBuffer()),/Struktur sumber perlu ditinjau/);
  const blankContinuation=normalize(fixture([repeated('Potongan'),{code:'',text:'Lanjutan [16 OH]'}],16).worksheets[0]);
  assert.equal(blankContinuation.rows.filter(r=>r.code==='-').length,1);assert.equal(blankContinuation.reconciliation.length,0);
  const faSource=fixture([{text:'Langsung [1 OH]',amount:100,vol:'1 OH',price:100},{code:'>',text:'Grup utama',amount:500},{text:'Dalam grup [1 OH]',amount:200,vol:'1 OH',price:200},{code:'>>',text:'Subgrup',amount:300},{text:'Dalam subgrup [1 OH]',amount:300,vol:'1 OH',price:300}],600);
  const faBook=new ExcelJS.Workbook(),faSheet=faBook.addWorksheet('FA');
  faSheet.getCell('B9').value='WA';faSheet.getCell('B10').value='WA.6621';faSheet.getCell('C11').value='EBA';faSheet.getCell('C12').value='EBA.001';faSheet.getCell('E13').value='051';faSheet.getCell('F14').value='051.0A';faSheet.getCell('H15').value='524111';
  ['Langsung','Dalam grup','Dalam subgrup'].forEach((name,i)=>{const r=16+i;faSheet.getCell('N'+r).value='524111. '+name;faSheet.getCell('Q'+r).value=(i+1)*100;faSheet.getCell('Z'+r).value=(i+1)*10;faSheet.getCell('AE'+r).value=(i+1)*90;});
  const faOutput=await processExcel(await faSource.xlsx.writeBuffer(),await faBook.xlsx.writeBuffer());
  const faWs=faOutput.worksheets[0],faEvaluator=createEvaluator(faWs);let faAccount;faWs.eachRow((row,r)=>{if(row.getCell(1).value==='524111')faAccount=r;});
  assert.equal(faOutput.faMatchingReport.matchedCount,3);assert.equal(faEvaluator.cell('AP'+faAccount),60);assert.equal(faEvaluator.cell('AQ'+faAccount),540);
  const special=new ExcelJS.Workbook().addWorksheet('eval');
  special.getCell('A1').value=0;special.getCell('A2').value=2;
  special.getCell('B1').value={formula:'PRODUCT(A1,A2)'};
  special.getCell('B2').value={formula:'SUM(A1:A2)'};
  special.getCell('B3').value={formula:'B4'};special.getCell('B4').value={formula:'B3'};
  special.getCell('B5').value={formula:'UNKNOWN(A1)'};
  assert.equal(createEvaluator(special).cell('B1'),0);
  assert.equal(createEvaluator(special).cell('B2'),2);
  assert.throws(()=>createEvaluator(special).cell('B3'),/CYCLE/);
  assert.throws(()=>createEvaluator(special).cell('B5'),/UNSUPPORTED/);
  special.getCell('B6').value={formula:'SUM(A9999999)'};assert.throws(()=>createEvaluator(special).cell('B6'),/INVALID_REFERENCE/);

  const zeroBook=fixture([{text:'Nol [0 ORG x 2 HR]',vol:'0 OH',price:100,amount:0}],0);
  const zeroBuffer=await zeroBook.xlsx.writeBuffer(),zeroOut=await processExcel(zeroBuffer);
  const zeroReport=await validate(zeroBuffer,zeroOut);assert.equal(zeroReport.overallStatus,'MATCH');assert.equal(zeroReport.totalBudgetAfter,0);

  // Equal and opposite detail differences do not give MATCH.
  book=fixture([{text:'Satu [1 OH]',vol:'1 OH',price:100,amount:100},{text:'Dua [1 OH]',vol:'1 OH',price:100,amount:100}],200);
  const buf=await book.xlsx.writeBuffer(),out=await processExcel(buf);
  const rows=[];out.worksheets[0].eachRow((r,n)=>{if(r.getCell(1).value==='-')rows.push(n);});
  out.worksheets[0].getCell('R'+rows[0]).value=110;
  out.worksheets[0].getCell('R'+rows[1]).value=90;
  report=await validate(buf,out);
  assert.equal(report.totalDiff,0);assert.equal(report.diffCount,2);assert.equal(report.overallStatus,'DIFF');
  // Valid details but invalid account formula must be visible.
  out.worksheets[0].getCell('R'+rows[0]).value=100;out.worksheets[0].getCell('R'+rows[1]).value=100;
  const ar=rows[0]-1;out.worksheets[0].getCell('S'+ar).value={formula:'SUM(S'+rows[0]+',S'+rows[1]+',S'+rows[1]+')'};
  report=await validate(buf,out);assert.equal(report.diffCount,0);assert.equal(report.overallStatus,'DIFF');
  assert(report.subtotalDiscrepancies.some(x=>x.level===7));
  out.worksheets[0].getCell('A'+rows[1]).value=null;
  report=await validate(buf,out);assert.equal(report.missingCount,1);
  out.worksheets[0].getCell('A'+rows[1]).value='-';
  out.worksheets[0].getCell('S'+rows[0]).value={formula:'UNKNOWN(R'+rows[0]+')'};
  report=await validate(buf,out);assert.equal(report.validationComplete,false);

  const repeatedNames=fixture([{text:'Nama sama [1 OH]',amount:100,vol:'1 OH',price:100},{text:'Nama sama [1 OH]',amount:200,vol:'1 OH',price:200}],300);
  const repeatedBuf=await repeatedNames.xlsx.writeBuffer(),repeatedOut=await processExcel(repeatedBuf);
  assert.equal((await validate(repeatedBuf,repeatedOut)).overallStatus,'MATCH');
  const externalOut=new ExcelJS.Workbook();await externalOut.xlsx.load(await repeatedOut.xlsx.writeBuffer());
  const ambiguousReport=await validate(repeatedBuf,externalOut);assert.equal(ambiguousReport.overallStatus,'INCOMPLETE');
  assert(ambiguousReport.diagnostics.some(x=>x.type==='AMBIGUOUS_MATCH'));
  const inputPath=path.join(__dirname,'../context/RINCIAN KERTAS KERJA SATKER (11).xlsx');
  const oldPath=path.join(__dirname,'../context/output_2026-10-12T06-21-10.xlsx');
  try {await fs.access(inputPath);}catch {console.log('RKK audit: local real workbook skipped; synthetic regressions passed.');return;}
  const realBuffer=await fs.readFile(inputPath),realInput=new ExcelJS.Workbook();await realInput.xlsx.load(realBuffer);
  const realAudit=normalize(realInput.worksheets[0]);
  assert.equal(realAudit.rows.filter(r=>r.code==='-').length,1665);
  assert.equal(realAudit.rows.filter(r=>r.code==='-').reduce((s,r)=>s+r.amount,0),117302994000);
  assert.equal(realAudit.warnings.filter(x=>x.type==='DETAIL_CALCULATION_DIFFERENCE').length,7);
  assert.equal(realAudit.issues.length,0);assert.equal(realAudit.reconciliation.length,0);
  for(const pair of [[1380,1381],[2482,2483]])assert(realAudit.findings.some(f=>JSON.stringify(f.sourceRows)===JSON.stringify(pair)));
  assert.equal(normalize(realInput.worksheets[0]),realAudit);
  const inspected=await batch.inspectSource({buffer:realBuffer,size:realBuffer.length,originalname:path.basename(inputPath)});
  assert.equal(inspected.metadata.valid,true);assert.equal(inspected.metadata.totalVal,117302994000);
  const realOut=await processExcel(realBuffer);
  const fixed=await validate(realBuffer,realOut);
  assert.equal(fixed.totalItemsCount,1665);assert.equal(fixed.missingCount,0);assert.equal(fixed.addedCount,0);
  assert.equal(fixed.totalBudgetDiff,299);assert.equal(fixed.totalDiff,299);
  assert.equal(fixed.validationComplete,true);
  assert(!fixed.subtotalDiscrepancies.some(x=>x.formulaDifference!==0));
  assert(fixed.normalizationFindings.some(f=>f.sourceRows.includes(2482)));
  await fs.mkdir(path.join(__dirname,'../context/verification'),{recursive:true});
  await realOut.xlsx.writeFile(path.join(__dirname,'../context/verification/output-normalized.xlsx'));
  await fs.writeFile(path.join(__dirname,'../context/verification/validation-report.json'),JSON.stringify(fixed,null,2));
  try {
    const old=new ExcelJS.Workbook();await old.xlsx.readFile(oldPath);
    const oldReport=await validate(realBuffer,old);
    assert.equal(oldReport.totalBudgetDiff,1101071299);assert.equal(oldReport.overallStatus,'DIFF');
    assert(oldReport.subtotalDiffCount>0);
  } catch(e) {if(e.code!=='ENOENT')throw e;}
  console.log('RKK audit: synthetic cases and real workbook passed; normalized total 117302994000; remaining rounding difference 299.');
}
module.exports=run;
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
