const ExcelJS = require('exceljs');
async function fixture({ unit = 'BPKK Bekasi', location = 'KOTA BEKASI', kppn = '171', amount = 10000, year, blockCodes = ['A', 'B'], mismatch = false, outputTargets = false } = {}) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('RKK_MULTIYEAR_SATKER');
  let row = 1;
  const add = (code, name, value, tag, marker) => {
    const r = ws.getRow(row++);
    if (code === '-') { r.getCell(4).value = '-'; r.getCell(5).value = name; }
    else { r.getCell(1).value = code; r.getCell(4).value = name; }
    if (value !== undefined) r.getCell(10).value = value;
    if (tag) r.getCell(12).value = tag;
    if (marker) r.getCell(11).value = marker;
    return r;
  };
  if (year) { ws.getCell('D' + row++).value = 'TAHUN ANGGARAN: ' + year; }
  add('026.04.WA', 'Program Dukungan Manajemen', amount * 2);
  add('6621', 'Dukungan Manajemen', mismatch ? amount * 3 : amount * 2);
  const kro = add('6621.EBA', 'Layanan Internal', amount * 2);
  if (outputTargets) kro.getCell(7).value = '2.0 Layanan';
  ws.getCell('D' + row++).value = 'Lokasi : ' + location;
  for (let i = 0; i < 2; i++) {
    const ro = add('6621.EBA.' + (i ? '995' : '994'), 'Layanan ' + i, amount);
    if (outputTargets) ro.getCell(7).value = '1.0 Layanan';
    add('051', 'Layanan Sarana Internal ' + unit, amount);
    add('A', 'Tanpa subkomponen', amount);
    add('521211', 'Belanja Bahan', amount, i ? 'PNP' : 'RM', blockCodes[i]);
    ws.getCell('D' + row++).value = '(KPPN.' + kppn + ')';
    add('-', 'ATK <script>bad()</script>', amount, null, '*');
  }
  ws.getCell('I' + row++).value = 'Jakarta, 25 September 2026';
  return { originalname: 'arbitrary.xlsx', buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
}
module.exports = fixture;
