const assert = require('node:assert/strict');
const app = require('../server');
const fixture = require('./recap-fixture');
const units = require('../src/config/unit-registry');
const loadSamples = require('./recap-samples');
const { fingerprint } = require('../src/utils/rkk-metadata');
async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const file = await fixture();
  const manifest = { fiscalYear:2027, sources:[{ sourceId:fingerprint(file.buffer),ownerId:'bpkk-bekasi',confirmed:true }] };
  async function post(route, files = [file], data, field = 'files') {
    const form = new FormData();
    files.forEach(f => form.append(field,new Blob([f.buffer]),f.originalname));
    if (data !== undefined) form.append('manifest', typeof data === 'string' ? data : JSON.stringify(data));
    const response = await fetch(base+route,{method:'POST',body:form});
    return { status:response.status,body:await response.json() };
  }
  try {
    const inspect = await post('/api/recap-hierarchy/inspect');
    assert.equal(inspect.status,200); assert.equal(inspect.body.sources[0].valid,true);
    const batch = await post('/api/recap-hierarchy/batch',[file],manifest);
    assert.equal(batch.status,200); assert.equal(batch.body.rootSummary.totalVal,20000);
    assert.equal(batch.body.compactDetails,true);
    assert.equal(batch.body.detailRecords.length,2);

    const exportPayload={items:require('./test-satig-export').exportItems(batch.body.hierarchyTree)};
    const exported=await fetch(base+'/api/recap-hierarchy/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(exportPayload)});
    assert.equal(exported.status,200);
    assert.match(exported.headers.get('content-type'),/spreadsheetml/);
    assert.match(exported.headers.get('content-disposition'),/Rekap_Kegiatan-KRO-RO.xlsx/);
    const exportedWorkbook=new (require('exceljs').Workbook)();
    await exportedWorkbook.xlsx.load(Buffer.from(await exported.arrayBuffer()));
    assert.deepEqual(exportedWorkbook.worksheets.map(s=>s.name),['Kegiatan-KRO-RO']);
    assert.equal(exportedWorkbook.worksheets[0].getCell('E4').result,20000);
    const badExport=await fetch(base+'/api/recap-hierarchy/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[]})});
    assert.equal(badExport.status,400);assert.match((await badExport.json()).detail,/Tidak ada rincian/);
    assert.deepEqual(batch.body.nodeSummaries.ROOT.digit6List.flatMap(a=>a.detailIndexes).sort(),[0,1]);
    assert.equal((await post('/api/recap-hierarchy',[file],undefined,'file')).body.rootSummary.totalVal,20000);
    assert.equal((await post('/api/validate',[file],undefined,'file')).status,200);
    const processForm=new FormData();processForm.append('file',new Blob([file.buffer]),file.originalname);
    const processed=await fetch(base+'/api/process',{method:'POST',body:processForm});
    assert.equal(processed.status,200);
    const summaryHeader=processed.headers.get('X-Validation-Summary');assert(summaryHeader.length<=6500);
    const summary=JSON.parse(decodeURIComponent(summaryHeader));assert.equal(summary.overallStatus,'MATCH');assert.equal(summary.totalBudgetDiff,0);
    assert.match(summary.reportUrl,/^\/api\/validation-reports\//);
    const fullReport=await fetch(base+summary.reportUrl);assert.equal(fullReport.status,200);assert.equal((await fullReport.json()).overallStatus,'MATCH');
    assert.equal((await fetch(base+'/api/validation-reports/not-a-report')).status,404);
    await processed.arrayBuffer();
    assert.equal((await post('/api/recap-hierarchy/batch',[file],'{broken')).status,400);
    assert.equal((await post('/api/recap-hierarchy/batch',[file],{...manifest,sources:[]})).status,400);
    assert.equal((await post('/api/recap-hierarchy/batch',[file],{...manifest,sources:[{...manifest.sources[0],confirmed:false}]})).status,422);
    assert.equal((await post('/api/recap-hierarchy/inspect',[])).status,400);
    assert.equal((await post('/api/recap-hierarchy/inspect',[file],undefined,'file')).status,400);
    const invalid = await post('/api/recap-hierarchy/inspect',[{originalname:'bad.xlsx',buffer:Buffer.from('broken')}]);
    assert.equal(invalid.status,200); assert.equal(invalid.body.sources[0].valid,false);
    assert.equal((await post('/api/recap-hierarchy/batch',[{originalname:'big.xlsx',buffer:Buffer.alloc(6*1024*1024)}],manifest)).status,413);

    // Real UI-generated custom units use UUIDs, which previously pushed this
    // small upload beyond the separate 4 MiB response limit.
    const realFiles = await loadSamples();
    if (realFiles.length) {
    const customUnits = [
      { id:'custom-00000000-0000-4000-8000-000000000001',name:'Dit. Bina PKK' },
      { id:'custom-00000000-0000-4000-8000-000000000002',name:'Setditjen' }
    ];
    const realManifest = { fiscalYear:2026,customUnits,sources:realFiles.map(f=>({
      sourceId:fingerprint(f.buffer),confirmed:true,
      ownerId:f.originalname.includes('PKK.xlsx') ? customUnits[0].id : f.originalname.includes('Ses.xlsx') ? customUnits[1].id :
        units.find(u=>f.originalname.includes(u.name)).id
    })) };
    const realBatch = await post('/api/recap-hierarchy/batch',realFiles,realManifest);
    assert.equal(realBatch.status,200,'Five small workbooks with UUID unit IDs must succeed');
    assert.equal(realBatch.body.rootSummary.totalVal,267500975000);
    assert.equal(realBatch.body.activityBranchCount,13);
    assert.equal(realBatch.body.detailRecords.length,2392);
    assert.ok(Buffer.byteLength(JSON.stringify(realBatch.body))<4*1024*1024);

    } else console.log('API: optional five-workbook integration skipped (local samples unavailable).');
    console.log('API: inspect, batch, legacy recap/validation, malformed manifests, invalid workbook, upload limits and JSON errors passed.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
if (require.main === module) run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports = run;
