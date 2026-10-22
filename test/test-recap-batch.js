const assert = require('node:assert/strict');
const loadSamples = require('./recap-samples');
const { performance } = require('perf_hooks');
const { inspectFiles, buildBatch, packRecap } = require('../src/utils/hierarchy-recap-batch');
const parseRecap = require('../src/utils/hierarchy-recap');
const { fingerprint } = require('../src/utils/rkk-metadata');
const fixture = require('./recap-fixture');
const ExcelJS = require('exceljs');
async function run() {
  const start = performance.now();
  const files = await loadSamples();
  let data;
  if (files.length) {
  const inspection = await inspectFiles(files);
  assert.ok(inspection.sources.every(s => s.valid));
  const manifest = { fiscalYear: 2027, customUnits: [{ id: 'custom-00000000-0000-4000-8000-000000000001', name: 'Dit. Bina PKK' }, { id: 'custom-00000000-0000-4000-8000-000000000002', name: 'Setditjen' }],
    sources: inspection.sources.map(s => ({ sourceId: s.sourceId, ownerId: s.ownerSuggestion?.id || (s.activityCodes.length > 2 ? 'custom-00000000-0000-4000-8000-000000000002' : 'custom-00000000-0000-4000-8000-000000000001'), confirmed: true })) };
  data = await buildBatch([...files].reverse(), manifest);
  assert.equal(data.rootSummary.totalVal, 267500975000);
  assert.equal(data.rootSummary.totalRM, 48466107000);
  assert.equal(data.rootSummary.totalPNBP, 157234868000);
  assert.equal(data.rootSummary.totalPLN, 61800000000);
  assert.equal(data.rootSummary.totalBlocked, 69710256000);
  assert.equal(data.activityCodeCount, 6);
  assert.equal(data.activityBranchCount, 13);
  const activities = Object.values(data.nodeSummaries).filter(n => n.level === 2);
  assert.equal(activities.filter(n => n.code === '2175').length, 4);
  assert.deepEqual(activities.filter(n => n.code === '6621').map(n => n.totalVal).sort((a,b) => a-b), [1019095000,3100000000,5300000000,6500000000,17083579000]);
  for (const source of data.sources) {
    const details = data.rootSummary.digit6List.flatMap(a => a.details).filter(d => d.sourceId === source.sourceId);
    assert.equal(details.reduce((sum,d) => sum + d.val, 0), source.totalVal);
    assert.ok(details.every(d => d.ownerId === source.ownerId && d.sheetName && d.fullPath && d.recordId));
  }
  assert.equal(new Set(data.rootSummary.digit6List.flatMap(a => a.details).map(d => d.recordId)).size, 2392);
  } else console.log('Batch: optional five-workbook integration skipped (local samples unavailable).');
  const file = await fixture();
  const small = { fiscalYear: 2027, sources: [{ sourceId: fingerprint(file.buffer), ownerId: 'bpkk-bekasi', confirmed: true }] };
  const filtered = await buildBatch([file], { ...small, filters: { ownerId: 'bpkk-kendari' } });
  assert.equal(filtered.rootSummary.totalVal, 0);
  assert.equal(filtered.hierarchyTree.children.length, 0);
  const mapped = await buildBatch([file], { ...small, sources: [{ ...small.sources[0], activityAssignments: [{ programCode:'026.04.WA',activityCode:'6621',responsibleUnitId:'bpkk-kendari' }] }], filters: { responsibleUnitId:'bpkk-kendari' } });
  assert.equal(mapped.rootSummary.totalVal, 20000);
  assert.equal(mapped.nodeSummaries[Object.keys(mapped.nodeSummaries).find(k => mapped.nodeSummaries[k].level === 2)].ownerId, 'bpkk-bekasi');
  const records = mapped.rootSummary.digit6List.flatMap(a => a.details);
  assert.deepEqual(records.map(r => r.blockCode).sort(), ['A','B']);
  assert.ok(records.every(r => r.responsibleUnitId === 'bpkk-kendari'));
  assert.equal((await parseRecap(file.buffer)).rootSummary.totalVal, 20000);
  await assert.rejects(buildBatch([file], { ...small, sources: [{ ...small.sources[0], confirmed:false }] }), /dikonfirmasi/);
  await assert.rejects(buildBatch([file], { ...small, sources: [{ ...small.sources[0], sourceId:'wrong' }] }), /manifest/);
  await assert.rejects(buildBatch([file,file], { ...small, sources: [small.sources[0], small.sources[0]] }), /duplikat/);
  const other = await fixture({ amount:20000 });
  await assert.rejects(buildBatch([file,other], { ...small, sources:[small.sources[0], { ...small.sources[0],sourceId:fingerprint(other.buffer) }] }), /versi aktif/);
  const dated = await fixture({ year:2026 });
  for (const fiscalYear of [undefined, null]) {
    const undatedBatch = await buildBatch([file], { ...small, fiscalYear });
    assert.equal(undatedBatch.fiscalYear,null);
    assert.equal(undatedBatch.rootSummary.totalVal,20000);
    const datedBatch = await buildBatch([dated], { ...small, fiscalYear, sources:[{...small.sources[0],sourceId:fingerprint(dated.buffer)}] });
    assert.equal(datedBatch.fiscalYear,2026);
  }
  for (const fiscalYear of [0,1999,2101,2026.5,'2026','']) {
    await assert.rejects(buildBatch([file], {...small,fiscalYear}), /opsional/);
  }
  const nextYear = await fixture({year:2027,unit:'BPKK Kendari'});
  const mixedSources = [
    {...small.sources[0],sourceId:fingerprint(dated.buffer)},
    {sourceId:fingerprint(nextYear.buffer),ownerId:'bpkk-kendari',confirmed:true}
  ];
  await assert.rejects(buildBatch([dated,nextYear], {sources:mixedSources}), /tahun berbeda/);
  await assert.rejects(buildBatch([dated,nextYear], {fiscalYear:null,sources:mixedSources,filters:{ownerId:'bpkk-bekasi'}}), /tahun berbeda/);
  const inferred = await buildBatch([dated,other], {sources:[mixedSources[0],{...mixedSources[1],sourceId:fingerprint(other.buffer)}]});
  assert.equal(inferred.fiscalYear,2026);
  assert.equal(inferred.rootSummary.totalVal,60000);
  await assert.rejects(buildBatch([dated], { ...small, sources:[{ ...small.sources[0],sourceId:fingerprint(dated.buffer) }] }), /Tahun anggaran/);
  const mismatched = await inspectFiles([await fixture({ mismatch:true })]);
  assert.equal(mismatched.sources[0].valid,false);
  assert.equal(mismatched.sources[0].reconciliation[0].difference,-10000);
  const smallAmount = await fixture({amount:50});
  const shiftedWb = new ExcelJS.Workbook();
  await shiftedWb.xlsx.load(smallAmount.buffer);
  shiftedWb.worksheets[0].eachRow(row => {if(row.getCell(4).value==='-'){row.getCell(10).value=null;row.getCell(11).value=50;row.getCell(13).value='*';}});
  const shiftedFile={originalname:'shifted.xlsx',buffer:Buffer.from(await shiftedWb.xlsx.writeBuffer())};
  const shifted=await buildBatch([shiftedFile],{...small,sources:[{...small.sources[0],sourceId:fingerprint(shiftedFile.buffer)}]});
  assert.equal(shifted.rootSummary.totalVal,100);
  shiftedWb.worksheets[0].eachRow(row=>{if(row.getCell(4).value==='-'){row.getCell(10).value='not-money';row.getCell(11).value='*';}});
  const badAmounts=await inspectFiles([{originalname:'bad-values.xlsx',buffer:Buffer.from(await shiftedWb.xlsx.writeBuffer())}]);
  assert.equal(badAmounts.sources[0].valid,false);
  assert.match(badAmounts.sources[0].error,/Nilai detail/);
  const duplicateInspection = await inspectFiles([file, { ...file,originalname:'copy.xlsx' }]);
  assert.equal(duplicateInspection.sources[1].valid,false);
  console.log('Batch: available sample checks, filters, mappings, revisions, duplicate files, reconciliation and compact references passed.');
  const packed = packRecap(data || mapped);
  assert.equal(packed.detailRecords.length,data ? 2392 : 2);
  assert.ok((data || mapped).rootSummary.digit6List.every(a=>Array.isArray(a.details)), 'Packing must not mutate canonical summaries');
  assert.ok(Object.keys(packed.nodeSummaries).every(k=>k==='ROOT'||/^N\d+$/.test(k)), 'Wire node IDs must not embed owner UUIDs');
  for (const [key,node] of Object.entries(packed.nodeSummaries)) {
    assert.equal(node.key,key);
    if(node.parentKey) assert.ok(packed.nodeSummaries[node.parentKey]);
    assert.deepEqual(node.childrenKeys,packed.childrenMap[key]||[]);
  }
  function verifyTree(node) {
    if(node.level<=6)assert.equal(packed.nodeSummaries[node.key].totalVal,node.totalVal);
    for(const child of node.children||[]) {assert.equal(child.parentKey,node.key);verifyTree(child);}
  }
  verifyTree(packed.hierarchyTree);
  for(const list of Object.values(packed.nodesByLevel))for(const node of list)assert.ok(packed.nodeSummaries[node.key]);
  assert.ok(Buffer.byteLength(JSON.stringify(packed)) < 4*1024*1024, 'Five-workbook response must fit API output limit');
  console.log((data ? 'Five-workbook integration plus edge cases: ' : 'Synthetic edge cases: ') + ((performance.now()-start)/1000).toFixed(2) + 's; RSS ' + (process.memoryUsage().rss/1024/1024).toFixed(1) + ' MiB; JSON ' + Buffer.byteLength(JSON.stringify(packed)) + ' bytes.');
}
if (require.main === module) run().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = run;
