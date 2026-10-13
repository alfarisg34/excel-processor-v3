const ExcelJS = require('exceljs');
const { inputError } = require('./rkk-metadata');
const template = require('../config/satig-export-template.json');

// Formats and header variants inspected in the SATIG Kegiatan-KRO-RO sheet.
const MONEY = '_-* #,##0_-;-* #,##0_-;_-* "-"??_-;_-@';
const TARGET = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@';
const widths = template.widths;
const satkerNames = {
  'bbpkk-bandung-barat': 'Satker Balai Besar Perluasan Kesempatan Kerja Bandung Barat',
  'bpkk-bekasi': 'BALAI PERLUASAN KESEMPATAN KERJA BEKASI',
  'bpkk-kendari': 'Balai Perluasan Kesempatan Kerja Kendari'
};

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.items) || !payload.items.length) throw inputError('Tidak ada rincian untuk diekspor.', 400);
  if (payload.items.length > 30000 || Buffer.byteLength(JSON.stringify(payload)) > 4 * 1024 * 1024) throw inputError('Data ekspor melebihi batas 30.000 node atau 4 MiB.', 413);
  const keys = new Set();
  for (const item of payload.items) {
    if (!item || !Number.isInteger(item.level) || item.level < 2 || item.level > 6 ||
        typeof item.key !== 'string' || !item.key || keys.has(item.key) ||
        typeof item.parentKey !== 'string' || typeof item.code !== 'string' || typeof item.name !== 'string' ||
        item.name.length > 2000 || item.code.length > 100 || item.key.length > 1000 ||
        ['totalVal', 'totalRM', 'totalPNBP', 'totalPLN'].some(k => !Number.isFinite(item[k])) ||
        (item.targetRenja != null && (!Number.isFinite(item.targetRenja) || item.targetRenja < 0)) ||
        ['ownerId', 'ownerName', 'targetUnit'].some(k => item[k] != null && (typeof item[k] !== 'string' || item[k].length > 2000))) {
      throw inputError('Node ekspor tidak valid atau duplikat.', 400);
    }
    keys.add(item.key);
  }
  const byKey = new Map(payload.items.map(item => [item.key, item]));
  for (const item of payload.items) {
    const parent = byKey.get(item.parentKey);
    if (parent && (parent.level !== item.level - 1 || parent.ownerId !== item.ownerId)) throw inputError('Relasi induk ekspor tidak valid.', 400);
  }
  return byKey;
}

function buildSatigWorkbook(payload) {
  validatePayload(payload);
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet('Kegiatan-KRO-RO', {
    views: [{ state: 'frozen', ySplit: 7, topLeftCell: 'B8', zoomScale: 68, zoomScaleNormal: 68, showGridLines: true }],
    pageSetup: { orientation: 'portrait', scale: 100, fitToPage: false,
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0, footer: 0 } }
  });
  widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
  ws.getColumn(1).hidden = true;
  const groups = new Map();
  for (const item of payload.items) {
    const id = item.ownerId || 'single-satker';
    if (!groups.has(id)) groups.set(id, { id, name: item.ownerName || 'Satker', items: [] });
    groups.get(id).items.push({ ...item, children: [] });
  }
  const orderedGroups = [...groups.values()].sort((a, b) => {
    const order = Array.isArray(payload.ownerOrder) ? payload.ownerOrder : [];
    const rank = id => order.includes(id) ? order.indexOf(id) : order.length;
    return rank(a.id) - rank(b.id);
  });
  function styleRow(row, kind, { fill, center = false } = {}) {
    row.height = center ? 18.5 : Math.max(15.5, Math.ceil(row.getCell(2).text.length / 67) * 14.5);
    for (let c = 2; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.style = structuredClone(template.styles[template.profiles[kind][c - 2]]);
      if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + fill } };
    }
  }
  const grand = ws.getRow(4);
  grand.getCell(2).value = 'GRAND TOTAL ANGGARAN DITJEN BINAPENTA DAN PKK';
  styleRow(grand, 'grand', { center: true });
  const summaryRows = [];
  let rowNumber = 5;
  function sumFrom(row, children) {
    for (const col of ['E', 'F', 'G', 'H']) {
      const references = children.map(child => col + child.rowNumber);
      const result = children.reduce((sum, child) => sum + child.totals[col], 0);
      row.getCell(col).value = { formula: references.join('+'), result };
    }
  }
  for (const [index, group] of orderedGroups.entries()) {
    const local = new Map(group.items.map(item => [item.key, item]));
    const roots = [];
    for (const item of group.items) {
      const parent = local.get(item.parentKey);
      if (parent) parent.children.push(item);
      else roots.push(item);
    }
    const summary = ws.getRow(rowNumber++);
    summary.getCell(2).value = satkerNames[group.id] || (/^satker\b/i.test(group.name) ? group.name : 'Satker ' + group.name);
    styleRow(summary, 'satker', { center: true });
    summary.height = Math.max(18.5, Math.ceil(summary.getCell(2).text.length / 67) * 20.25);
    const header = rowNumber;
    ws.getRow(header).values = [null, 'KEGIATAN/KRO/RO', 'Target Renja', 'Satuan', 'ANGGARAN', 'Sumber Dana'];
    ws.getRow(header + 1).values = [null, null, null, null, null, 'PNBP', 'PHLN', 'RM'];
    for (const c of ['C', 'D']) ws.mergeCells(`${c}${header}:${c}${header + 1}`);
    ws.mergeCells(`F${header}:H${header}`);
    if (!index) {
      for (const c of ['B', 'E', 'I']) ws.mergeCells(`${c}${header}:${c}${header + 1}`);
      ws.getCell('I' + header).value = 'Unit Cost';
    } else if (index === 2) ws.mergeCells(`E${header}:E${header + 1}`);
    styleRow(ws.getRow(header), index ? 'laterHeaderTop' : 'headerTop', { center: true });
    styleRow(ws.getRow(header + 1), index ? 'laterHeaderBottom' : 'headerBottom', { center: true });
    ws.getRow(header).height = ws.getRow(header + 1).height = index ? 15.75 : 15.5;
    rowNumber += 2;
    function writeNode(item, highlighted = false) {
      const code = item.level === 3 || item.level === 4 ? item.code.split('.').pop() : item.code;
      const suffix = ' — ' + group.name;
      const name = item.level === 2 && item.name.includes(suffix) ? item.name.slice(0, item.name.lastIndexOf(suffix)) : item.name;
      const row = ws.getRow(rowNumber++);
      item.rowNumber = row.number;
      row.getCell(2).value = `${code} - ${name}`;
      highlighted ||= group.id === 'bbpkk-bandung-barat' && item.level === 3 && /^2175\.(QDC|QEA)$/.test(item.code);
      styleRow(row, {2:'kegiatan',3:'kro',4:'ro',5:'komponen',6:'subkomponen'}[item.level], { fill: highlighted ? 'FFC000' : undefined });
      if ([3, 4].includes(item.level) && Number.isFinite(item.targetRenja)) {
        row.getCell(3).value = item.targetRenja;
        row.getCell(4).value = item.targetUnit || null;
      }
      for (const child of item.children) writeNode(child, highlighted);
      if (item.children.length) {
        sumFrom(row, item.children);
        item.totals = Object.fromEntries(['E','F','G','H'].map(col => [col, row.getCell(col).result]));
      } else {
        item.totals = { F: item.totalPNBP, G: item.totalPLN, H: item.totalRM, E: item.totalPNBP + item.totalPLN + item.totalRM };
        for (const col of ['F','G','H']) if (item.totals[col] !== 0) row.getCell(col).value = item.totals[col];
        row.getCell(5).value = { formula: `F${row.number}+G${row.number}+H${row.number}`, result: item.totals.E };
      }
      if (item.level === 4 && item.targetRenja > 0) row.getCell(9).value = { formula: `E${row.number}/C${row.number}`, result: item.totals.E / item.targetRenja };
    }
    roots.forEach(root => writeNode(root));
    sumFrom(summary, roots);
    summaryRows.push({ rowNumber: summary.number, totals: Object.fromEntries(['E','F','G','H'].map(col => [col, summary.getCell(col).result])) });
  }
  sumFrom(grand, summaryRows);
  return wb;
}

module.exports = { buildSatigWorkbook, MONEY, TARGET };
