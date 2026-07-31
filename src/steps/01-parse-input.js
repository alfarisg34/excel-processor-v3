const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { unwrapTextValue, getCellText } = require('../utils/excel-helpers');

/**
 * Step 1: Read input Excel file, unmerge cells, unwrap text, clear blank cells
 * @param {Buffer} buffer - Buffer of uploaded RINCIAN KERTAS KERJA file
 * @returns {Promise<ExcelJS.Workbook>} Loaded and cleaned workbook
 */
async function parseInput(buffer) {
  const workbook = new ExcelJS.Workbook();
  const stream = Readable.from(buffer);
  await workbook.xlsx.read(stream);

  workbook.worksheets.forEach((worksheet) => {
    // 1. Unmerge all merged ranges
    const merges = [...(worksheet.model?.merges || [])];
    merges.forEach((m) => {
      try {
        worksheet.unmergeCells(m);
      } catch (err) {
        // Ignore
      }
    });

    // 2. Iterate each row & cell to unwrap text & clean up (master cells only)
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        // Do not touch slave cells to avoid mutating master values
        if (!cell.isMerged || cell.master === cell) {
          if (cell.value !== null && cell.value !== undefined && !cell.formula) {
            const rawStr = getCellText(cell);
            if (rawStr) {
              cell.value = unwrapTextValue(rawStr);
            }
          }
        }
      });
    });
  });

  return workbook;
}

module.exports = parseInput;
