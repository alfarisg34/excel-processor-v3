const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { getCellText } = require('./excel-helpers');
const patterns = require('./patterns');
const units = require('../config/unit-registry');

const LIMITS = Object.freeze({ files: 10, fileBytes: 5 * 1024 * 1024, totalBytes: 20 * 1024 * 1024, rows: 30000, sheets: 10 });
function inputError(message, status = 422) {
  const error = new Error(message);
  error.status = status;
  return error;
}
function fingerprint(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function checkFiles(files) {
  if (!Array.isArray(files) || !files.length) throw inputError('Upload minimal satu file XLSX.', 400);
  if (files.length > LIMITS.files || files.reduce((s, f) => s + f.buffer.length, 0) > LIMITS.totalBytes)
    throw inputError('Maksimal 10 file dan total upload 20 MiB per batch.', 413);
  for (const file of files) {
    if (!file.buffer.length) throw inputError('File kosong: ' + file.originalname, 400);
    if (file.buffer.length > LIMITS.fileBytes) throw inputError('Maksimal 5 MiB per file: ' + file.originalname, 413);
  }
}
function extractMetadata(ws, sourceId, originalName, size) {
  const evidence = [], evidenceKeys = new Set();
  const locations = new Set(), kppnCodes = new Set(), years = new Set();
  const programs = new Map(), activities = new Map(), candidates = new Map();
  let programCode = '', activityCode = '';
  let satkerCode = null, satkerName = null;
  const add = (cell, text, type, unitId) => {
    const key = JSON.stringify([type, text, unitId]);
    if (evidenceKeys.has(key)) return;
    evidenceKeys.add(key);
    if (evidence.length < 100) evidence.push({ sheetName: ws.name, cell, text, type, unitId, programCode, activityCode });
  };
  ws.eachRow((row) => {
    const code = [1, 2, 3].map(c => getCellText(row.getCell(c))).find(Boolean) || '';
    const name = [4, 5, 6].map(c => getCellText(row.getCell(c))).find(Boolean) || '';
    if (patterns.CODE_322.test(code)) { programCode = code; activityCode = ''; programs.set(code, name); }
    if (patterns.DIGIT_4.test(code) && programCode) {
      activityCode = code;
      activities.set(programCode + '/' + code, { programCode, code, name });
    }
    row.eachCell((cell) => {
      const text = getCellText(cell);
      if (!text) return;
      const normalized = text.toUpperCase().replace(/\s+/g, ' ').trim();
      const location = text.match(/^Lokasi\s*:\s*(.+)$/i);
      if (location) { locations.add(location[1].trim().toUpperCase()); add(cell.address, text, 'location'); }
      const kppn = text.match(/\bKPPN[.\s]+(\d{3})/i);
      if (kppn) { kppnCodes.add(kppn[1]); add(cell.address, text, 'kppn'); }
      // Only explicit labelled headers; footer dates are deliberately ignored.
      let labelled = text;
      if (/^(?:TAHUN ANGGARAN|TA|SATKER|SATUAN KERJA)\s*:?\s*$/i.test(text)) {
        const adjacent = [];
        row.eachCell(next => { if (next.col > cell.col) { const value = getCellText(next); if (value) adjacent.push(value); } });
        labelled = text.replace(/:?\s*$/, ': ') + adjacent.join(' ');
      }
      const year = labelled.match(/^(?:TAHUN ANGGARAN|TA)\s*:?\s*(20\d{2})\b/i);
      if (year) { years.add(Number(year[1])); add(cell.address, text, 'fiscalYear'); }
      const satker = labelled.match(/^(?:SATKER|SATUAN KERJA)\s*:\s*(?:\((\d{6})\)|(\d{6}))?\s*[-:]?\s*(.*)$/i);
      if (satker) { satkerCode = satker[1] || satker[2] || null; satkerName = satker[3] || null; add(cell.address, text, 'satkerHeader'); }
      for (const unit of units) {
        if (unit.aliases.some(alias => normalized.includes(alias))) {
          candidates.set(unit.id, { id: unit.id, name: unit.name });
          add(cell.address, text, 'unitMention', unit.id);
        }
      }
      if (/\bDIT\.?\s+BPKK\b/i.test(text)) add(cell.address, text, 'unverifiedDirectorateAlias');
      else if (/\bDIREKTORAT\b/i.test(text)) add(cell.address, text, 'directorateMention');
    });
  });
  if (!programs.size || !activities.size) throw inputError('Sheet pertama tidak memiliki tabel program/kegiatan RKK yang didukung.');
  const corroborated = [...candidates.values()].filter(c => {
    const unit = units.find(u => u.id === c.id);
    return locations.has(unit.location) && kppnCodes.has(unit.kppn);
  });
  const headerUnits = satkerName ? units.filter(u => u.aliases.some(alias => satkerName.toUpperCase().replace(/\s+/g, ' ').includes(alias))) : [];
  const suggested = headerUnits.length === 1 ? { id: headerUnits[0].id, name: headerUnits[0].name } : (candidates.size === 1 && corroborated.length === 1 ? corroborated[0] : null);
  return {
    sourceId, originalName, sheetName: ws.name, rowCount: ws.rowCount, size,
    satkerCode, satkerName, fiscalYear: years.size === 1 ? [...years][0] : null,
    fiscalYears: [...years], locations: [...locations], kppnCodes: [...kppnCodes],
    programCodes: [...programs.keys()], activities: [...activities.values()],
    activityCodes: [...new Set([...activities.values()].map(a => a.code))],
    candidates: [...candidates.values()], evidence,
    ownerSuggestion: suggested,
    identificationStatus: suggested ? 'suggested' : (candidates.size || evidence.some(e => /Directorate|directorate/.test(e.type)) ? 'ambiguous' : 'unresolved')
  };
}
async function loadSource(file) {
  if (!/\.xlsx$/i.test(file.originalname)) throw inputError('Format hanya XLSX: ' + file.originalname);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(file.buffer); }
  catch { throw inputError('Workbook XLSX rusak atau tidak didukung: ' + file.originalname); }
  if (!workbook.worksheets.length || workbook.worksheets.length > LIMITS.sheets)
    throw inputError('Jumlah worksheet tidak didukung: ' + file.originalname);
  const ws = workbook.worksheets[0];
  if (ws.rowCount > LIMITS.rows || ws.columnCount > 100)
    throw inputError('Worksheet melebihi batas 30.000 baris / 100 kolom: ' + file.originalname, 413);
  return { ws, metadata: extractMetadata(ws, fingerprint(file.buffer), file.originalname, file.buffer.length) };
}
module.exports = { LIMITS, inputError, fingerprint, checkFiles, extractMetadata, loadSource };
