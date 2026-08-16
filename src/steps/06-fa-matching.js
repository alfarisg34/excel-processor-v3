const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { getCellText } = require('../utils/excel-helpers');

/**
 * Helper to parse Laporan FA Detail (16 Segmen)
 * @param {Buffer} faBuffer
 * @returns {Promise<Array<{uraian: string, sisa: number}>>}
 */
async function parseLaporanFA(faBuffer) {
  const faWorkbook = new ExcelJS.Workbook();
  const stream = Readable.from(faBuffer);
  await faWorkbook.xlsx.read(stream);

  const ws = faWorkbook.worksheets[0];
  const items = [];

  ws.eachRow({ includeEmpty: false }, (row) => {
    const sisaCell = row.getCell(31).value;
    if (sisaCell === null || sisaCell === undefined) return;

    let sisaNum = null;
    if (typeof sisaCell === 'number') {
      sisaNum = sisaCell;
    } else if (typeof sisaCell === 'object' && sisaCell.result !== undefined) {
      sisaNum = parseFloat(String(sisaCell.result).replace(/[^0-9.-]/g, ''));
    } else {
      sisaNum = parseFloat(String(sisaCell).replace(/[^0-9.-]/g, ''));
    }

    if (isNaN(sisaNum)) return;

    // Scan columns 1-32 for 6-digit prefix like "000002. Konsumsi Rapat"
    for (let c = 1; c <= 32; c++) {
      const str = getCellText(row.getCell(c));
      if (/^\d{6}\.\s/.test(str)) {
        const clean = str.replace(/^\d{6}\.\s*/, '').trim();
        if (clean) {
          items.push({ uraian: clean, sisa: sisaNum });
        }
        break;
      }
    }
  });

  return items;
}

/**
 * Step 6: Match Laporan FA to worksheet detail rows and insert Sisa Anggaran in Column 51 (AY)
 * @param {ExcelJS.Workbook} workbook
 * @param {Buffer} [faBuffer] - Optional Laporan FA file buffer
 */
async function faMatching(workbook, faBuffer) {
  if (!faBuffer) {
    return; // Optional step, skip if no FA file provided
  }

  const faData = await parseLaporanFA(faBuffer);
  if (!faData || faData.length === 0) {
    return;
  }

  // Build lookup dictionary by uraian name
  const faByName = {};
  for (const { uraian, sisa } of faData) {
    if (!faByName[uraian]) faByName[uraian] = [];
    faByName[uraian].push(sisa);
  }

  const usedCount = {};

  workbook.worksheets.forEach((worksheet) => {
    // Target Column 56 (BD)
    const colFA = 56;

    // Set header at row 1 & row 2
    worksheet.getRow(1).getCell(colFA).value = 'SISA ANGGARAN';
    worksheet.getRow(2).getCell(colFA).value = 'REALISASI FA';

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 4) return;
      const valA = getCellText(row.getCell(1));
      const valB = getCellText(row.getCell(2));

      // Match detail rows where Col A is '-'
      const isDetailRow = valA === '-';
      const uraianStr = valB.trim();

      if (isDetailRow && uraianStr && faByName[uraianStr]) {
        const idx = usedCount[uraianStr] || 0;
        if (idx < faByName[uraianStr].length) {
          row.getCell(colFA).value = faByName[uraianStr][idx];
          usedCount[uraianStr] = idx + 1;
        }
      }
    });
  });
}

module.exports = faMatching;
