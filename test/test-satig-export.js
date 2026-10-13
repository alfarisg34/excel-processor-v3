const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { buildSatigWorkbook, MONEY, TARGET } = require('../src/utils/satig-hierarchy-export');
const { buildBatch } = require('../src/utils/hierarchy-recap-batch');
const fixture = require('./recap-fixture');
const { fingerprint } = require('../src/utils/rkk-metadata');

function exportItems(node) {
  return [...(node.level >= 2 && node.level <= 6 ? [node] : []), ...(node.children || []).flatMap(exportItems)];
}
async function run() {
  const a = await fixture({ outputTargets: true }), b = await fixture({ unit: 'BPKK Kendari', location: 'KOTA KENDARI', kppn: '060', amount: 20000 });
  const batch = await buildBatch([a,b], { fiscalYear:2027, sources:[
    { sourceId:fingerprint(a.buffer),ownerId:'bpkk-bekasi',confirmed:true },
    { sourceId:fingerprint(b.buffer),ownerId:'bpkk-kendari',confirmed:true }
  ] });
  const payload = {items:exportItems(batch.hierarchyTree),ownerOrder:['bpkk-bekasi','bpkk-kendari']};
  const original = buildSatigWorkbook(payload);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await original.xlsx.writeBuffer());
  assert.deepEqual(wb.worksheets.map(s=>s.name),['Kegiatan-KRO-RO']);
  const ws = wb.worksheets[0];
  for(let r=1;r<=3;r++)assert.equal(ws.getRow(r).actualCellCount,0);
  assert.equal(ws.getColumn(1).hidden,true);
  assert.equal(ws.views[0].state,'frozen');assert.equal(ws.views[0].ySplit,7);assert.equal(ws.views[0].zoomScale,68);
  assert.equal(ws.pageSetup.orientation,'portrait');assert.equal(ws.pageSetup.scale,100);
  assert.equal(ws.getCell('B4').value,'GRAND TOTAL ANGGARAN DITJEN BINAPENTA DAN PKK');
  assert.equal(ws.getCell('B4').fill.fgColor.argb,'FFFFFF00');
  assert.equal(ws.getCell('E4').fill.fgColor.argb,'FFD9D9D9');
  assert.equal(ws.getCell('E4').font.name,'Arial');
  assert.equal(ws.getCell('B5').fill.fgColor.argb,'FF4472C4');
  assert.equal(ws.getCell('B5').font.color.argb,'FFFFFFFF');
  assert.equal(ws.getCell('B6').value,'KEGIATAN/KRO/RO');
  assert.equal(ws.getCell('B6').fill.fgColor.argb,'FFD9E2F3');
  assert.equal(ws.getCell('I6').value,'Unit Cost');
  assert.deepEqual(['F7','G7','H7'].map(a=>ws.getCell(a).value),['PNBP','PHLN','RM']);
  assert.equal(ws.getCell('B8').value,'6621 - Dukungan Manajemen');
  assert.equal(ws.getCell('B8').fill.fgColor.argb,'FFFFFF00');
  assert.equal(ws.getCell('B9').value,'EBA - Layanan Internal');
  assert.equal(ws.getCell('B10').value,'994 - Layanan 0');
  assert.equal(ws.getCell('B10').font.color.argb,'FF0070C0');
  assert.equal(ws.getCell('C9').value,2);assert.equal(ws.getCell('C10').value,1);assert.equal(ws.getCell('D10').value,'Layanan');
  assert.equal(ws.getCell('I10').formula,'E10/C10');assert.equal(ws.getCell('I10').result,10000);
  assert.equal(ws.getCell('I10').numFmt,TARGET);assert.equal(ws.getCell('E10').numFmt,MONEY);
  assert.equal(ws.getCell('E10').formula,'E11');
  assert.equal(ws.getCell('E11').formula,'E12');
  assert.equal(ws.getCell('E9').formula,'E10+E13');
  assert.equal(ws.getCell('E4').result,60000);assert.equal(ws.getCell('F4').result,30000);assert.equal(ws.getCell('H4').result,30000);
  assert.equal(ws.getCell('G4').result,0,'Zero funding must survive cached formula serialization');
  const laterHeaders=[];
  ws.eachRow(row=>{
    assert.equal(row.outlineLevel,0);
    assert.ok(!/^\s{2,}/.test(row.getCell(2).text));
    assert.ok(!row.getCell(2).text.includes('026.04.WA'));
    assert.ok(!row.getCell(2).text.includes('521211'));
    if(row.number>7 && row.getCell(2).value==='KEGIATAN/KRO/RO')laterHeaders.push(row.number);
  });
  assert.equal(laterHeaders.length,1);assert.equal(ws.getCell('I'+laterHeaders[0]).value,null);
  const secondRo=payload.items.find(item=>item.level===4 && item.ownerId==='bpkk-kendari');
  const missingRow=ws.getRows(1,ws.rowCount).find(row=>row.getCell(2).text===secondRo.code.split('.').pop()+' - '+secondRo.name && row.number>laterHeaders[0]);
  assert.equal(missingRow.getCell(3).value,null);assert.equal(missingRow.getCell(9).value,null);
  const zero = buildSatigWorkbook({items:[{...payload.items.find(i=>i.level===4),targetRenja:0}]});
  assert.equal(zero.worksheets[0].getCell('C8').value,0);assert.equal(zero.worksheets[0].getCell('I8').value,null);
  const fractional=buildSatigWorkbook({items:[{...payload.items.find(i=>i.level===4),targetRenja:2.5}]});
  assert.equal(fractional.worksheets[0].getCell('I8').result,4000);
  // Searching one RO recalculates exported subtotals rather than repeating the full scope total.
  const firstRo=payload.items.find(i=>i.level===4);
  const selected=payload.items.filter(i=>i.key===firstRo.key || i.parentKey===firstRo.key || i.level<4).filter(i=>i.ownerId===firstRo.ownerId);
  const focused=buildSatigWorkbook({items:selected});
  assert.equal(focused.worksheets[0].getCell('E4').result,10000);
  assert.throws(()=>buildSatigWorkbook({items:[]}),/Tidak ada rincian/);
  assert.throws(()=>buildSatigWorkbook({items:[{...payload.items[0],level:7}]}),/tidak valid/);
  assert.throws(()=>buildSatigWorkbook({items:[payload.items[0],payload.items[0]]}),/duplikat/);
  assert.throws(()=>buildSatigWorkbook({items:[{...payload.items[0],totalVal:Infinity}]}),/tidak valid/);
  assert.throws(()=>buildSatigWorkbook({items:[payload.items[0],{...payload.items[1],ownerId:'other'}]}),/Relasi induk/);
  // Five sections must repeat headers and keep the reference's special Bandung branches.
  const fiveItems=['custom-ses','custom-pkk','bbpkk-bandung-barat','bpkk-bekasi','bpkk-kendari'].flatMap((ownerId,index)=>{
    const prefix='owner'+index;
    return payload.items.filter(i=>i.ownerId==='bpkk-bekasi').map(i=>({
      ...i,key:prefix+i.key,parentKey:prefix+i.parentKey,ownerId,ownerName:'Unit '+index,
      code:i.level===3 && index===2?'2175.QDC':i.code
    }));
  });
  const five=buildSatigWorkbook({items:fiveItems});const fiveSheet=five.worksheets[0];
  const repeated=[];fiveSheet.eachRow(row=>{if(row.getCell(2).value==='KEGIATAN/KRO/RO' && row.number!==7)repeated.push(row.number);});
  assert.equal(repeated.length,5);
  assert.equal(fiveSheet.getCell('E4').result,100000);
  const highlighted=fiveSheet.getRows(1,fiveSheet.rowCount).find(r=>r.getCell(2).text==='QDC - Layanan Internal');
  assert.equal(highlighted.getCell(2).fill.fgColor.argb,'FFFFC000');
  assert.equal(fiveSheet.getRow(highlighted.number+1).getCell(2).fill.fgColor.argb,'FFFFC000');
  for(const header of repeated.slice(1))assert.deepEqual(['F','G','H'].map(c=>fiveSheet.getCell(c+(header+1)).value),['PNBP','PHLN','RM']);
  // Compare persisted prototype styling with the actual reference when locally available.
  try {
    const template=new ExcelJS.Workbook();await template.xlsx.readFile('context/SATIG_Setelah Buka Blokir A dan SISTEM PPTKA  05102026.xlsx');
    const source=template.getWorksheet('Kegiatan-KRO-RO');
    for(let c=1;c<=9;c++)assert.equal(ws.getColumn(c).width,source.getColumn(c).width);
    for(const addr of ['B4','E4','B8','E8','B9','B10','E10']) {
      assert.equal(ws.getCell(addr).font.name,source.getCell(addr).font.name);
      assert.equal(ws.getCell(addr).font.size,source.getCell(addr).font.size);
      assert.equal(ws.getCell(addr).numFmt,source.getCell(addr).numFmt);
      assert.deepEqual(ws.getCell(addr).border,source.getCell(addr).border);
    }
    console.log('SATIG: local reference widths, fonts, borders and formats matched after XLSX round trip.');
  } catch(error) { if(error.code==='ENOENT' || /File not found/.test(error.message))console.log('SATIG: optional local template comparison skipped (reference unavailable).');else throw error; }
  console.log('SATIG: native XLSX round trip, single sheet, blank top rows, satker groups, repeated headers, funding totals, direct-child formulas, targets, zero/fractional/missing targets and filtered scope passed.');
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports=run;
module.exports.exportItems=exportItems;
