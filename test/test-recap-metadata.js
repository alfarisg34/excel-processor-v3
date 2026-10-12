const assert = require('node:assert/strict');
const loadSamples = require('./recap-samples');
const { loadSource } = require('../src/utils/rkk-metadata');
const fixture = require('./recap-fixture');
const ExcelJS = require('exceljs');
async function run() {
  const samples = await loadSamples();
  if (!samples.length) console.log('Metadata: optional five-workbook integration skipped (local samples unavailable).');
  for (const {originalname:name,buffer} of samples) {
    const a = (await loadSource({ originalname: name, buffer })).metadata;
    const b = (await loadSource({ originalname: 'renamed.xlsx', buffer })).metadata;
    assert.deepEqual(a.evidence, b.evidence);
    assert.deepEqual(a.ownerSuggestion, b.ownerSuggestion);
    assert.equal(a.sourceId, b.sourceId);
    assert.equal(a.fiscalYear, null, 'Footer date must not become fiscal year');
    assert.equal(a.activityCodes.includes('6621'), true);
    if (/Bandung|Bekasi|Kendari/.test(name)) assert.ok(a.ownerSuggestion);
    else assert.equal(a.ownerSuggestion, null);
  }
  const headerFile = await fixture({unit:'Unknown unit',location:'Other city',kppn:'999'});
  const headerWb = new ExcelJS.Workbook();
  await headerWb.xlsx.load(headerFile.buffer);
  headerWb.worksheets[0].getCell('A25').value='TAHUN ANGGARAN';
  headerWb.worksheets[0].getCell('D25').value=2027;
  headerWb.worksheets[0].getCell('A26').value='SATKER';
  headerWb.worksheets[0].getCell('D26').value='(123456) BPKK Bekasi';
  const header = (await loadSource({originalname:'header.xlsx',buffer:Buffer.from(await headerWb.xlsx.writeBuffer())})).metadata;
  assert.equal(header.fiscalYear,2027);
  assert.equal(header.satkerCode,'123456');
  assert.equal(header.ownerSuggestion.id,'bpkk-bekasi');
  const labelled = (await loadSource(await fixture({ year: 2027 }))).metadata;
  assert.equal(labelled.fiscalYear, 2027);
  await assert.rejects(loadSource({ originalname: 'binary.xls', buffer: Buffer.from('x') }), /XLSX/);
  await assert.rejects(loadSource({ originalname: 'bad.xlsx', buffer: Buffer.from('broken') }), /rusak/);
  console.log('Metadata: available sample checks, labelled headers and invalid formats passed.');
}
if (require.main === module) run().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = run;
