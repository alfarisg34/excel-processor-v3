const { getCellText } = require('../utils/excel-helpers');
const PATTERNS = require('../utils/patterns');

/**
 * Step 3: Add volume multiplication formulas, convert to numbers, and add hierarchical SUM formulas
 * Targeting Column P (16) for VOL and Column S (19) for JUMLAH in 20-column layout
 * @param {ExcelJS.Workbook} workbook
 */
async function formulas(workbook) {
  workbook.worksheets.forEach((worksheet) => {
    // 1. Add multiplication formulas in Column P (index 16) and detail JUMLAH formula in Column S (index 19)
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const valA = getCellText(row.getCell(1));
      const valE = getCellText(row.getCell(5));
      const valH = getCellText(row.getCell(8));
      const valK = getCellText(row.getCell(11));
      const valN = getCellText(row.getCell(14));

      // Multipliers: Col E (5), Col H (8), Col K (11), Col N (14)
      const multipliers = [];
      if (valE) multipliers.push('E' + rowNumber);
      if (valH) multipliers.push('H' + rowNumber);
      if (valK) multipliers.push('K' + rowNumber);
      if (valN) multipliers.push('N' + rowNumber);

      if (multipliers.length > 1) {
        row.getCell(16).value = { formula: multipliers.join('*') };
      }

      // If RO level (e.g. 2175.BDC.001), set VOL RO (Col C / 3) = P[rowNumber]
      if (PATTERNS.CODE_433.test(valA)) {
        row.getCell(3).value = { formula: `P${rowNumber}` };
      }

      // Column S = P * R for detail rows or rows with price
      const valP = row.getCell(16).value !== null && row.getCell(16).value !== undefined ? String(row.getCell(16).value) : '';
      const valR = getCellText(row.getCell(18));

      if (valP && valR && (valA === '-' || valA === '>' || valA === '>>')) {
        row.getCell(19).value = { formula: `P${rowNumber}*R${rowNumber}` };
      }
    });

    // 2. Convert string values in Column P (16) and R (18) to actual numbers
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      [16, 18].forEach((colIdx) => {
        const cell = row.getCell(colIdx);
        if (cell.value && typeof cell.value === 'string' && !cell.formula) {
          const clean = cell.value
            .replace(/\./g, '')
            .replace(/,/g, '.')
            .replace(/[^\d.-]/g, '')
            .trim();
          const num = parseFloat(clean);
          if (!isNaN(num)) {
            cell.value = num;
          }
        }
      });
    });

    // 3. Hierarchical SUM formulas in Column S (col index 19) from bottom to top
    const rowCount = worksheet.rowCount;

    for (let r = rowCount; r >= 1; r--) {
      const row = worksheet.getRow(r);
      const valA = getCellText(row.getCell(1));

      let formula = null;

      if (valA === '>' || valA === '>>') {
        formula = createSumForGreaterThan(worksheet, r);
      } else if (PATTERNS.DIGIT_6.test(valA)) {
        formula = createSumFor6Digit(worksheet, r);
      } else if (PATTERNS.SINGLE_ALPHA.test(valA)) {
        formula = createSumForSingleAlphabet(worksheet, r);
      } else if (PATTERNS.DIGIT_3.test(valA)) {
        formula = createSumFor3Digit(worksheet, r);
      } else if (PATTERNS.CODE_433.test(valA)) {
        formula = createSumFor433Code(worksheet, r);
      } else if (PATTERNS.CODE_43.test(valA)) {
        formula = createSumFor43Code(worksheet, r);
      } else if (PATTERNS.DIGIT_4.test(valA)) {
        formula = createSumFor4Digit(worksheet, r);
      } else if (PATTERNS.CODE_322.test(valA)) {
        formula = createSumFor322Code(worksheet, r);
      }

      if (formula) {
        row.getCell(19).value = { formula: formula };
      }
    }
  });
}

function createSumForGreaterThan(worksheet, startRow) {
  const sumCells = [];
  const total = worksheet.rowCount;
  for (let r = startRow + 1; r <= total; r++) {
    const valA = getCellText(worksheet.getRow(r).getCell(1));
    if (valA === '-') {
      sumCells.push(`S${r}`);
    } else {
      break;
    }
  }
  return sumCells.length > 0 ? `SUM(${sumCells.join(',')})` : null;
}

function createSumFor6Digit(worksheet, startRow) {
  const sumCells = [];
  const total = worksheet.rowCount;
  let inSubGroup = false;

  for (let r = startRow + 1; r <= total; r++) {
    const valA = getCellText(worksheet.getRow(r).getCell(1));
    if (PATTERNS.DIGIT_6.test(valA) || PATTERNS.SINGLE_ALPHA.test(valA) || PATTERNS.DIGIT_3.test(valA)) break;

    if (valA === '>' || valA === '>>') {
      sumCells.push(`S${r}`);
      inSubGroup = true;
    } else if (valA === '-') {
      if (!inSubGroup) {
        sumCells.push(`S${r}`);
      }
    }
  }
  return sumCells.length > 0 ? `SUM(${sumCells.join(',')})` : null;
}

function createSumForSingleAlphabet(worksheet, startRow) {
  const sumCells = [];
  const total = worksheet.rowCount;
  for (let r = startRow + 1; r <= total; r++) {
    const valA = getCellText(worksheet.getRow(r).getCell(1));
    if (PATTERNS.SINGLE_ALPHA.test(valA) || PATTERNS.DIGIT_3.test(valA)) break;
    if (PATTERNS.DIGIT_6.test(valA)) sumCells.push(`S${r}`);
  }
  return sumCells.length > 0 ? `SUM(${sumCells.join(',')})` : null;
}

function createSumFor3Digit(worksheet, startRow) {
  const sumCells = [];
  const total = worksheet.rowCount;
  for (let r = startRow + 1; r <= total; r++) {
    const valA = getCellText(worksheet.getRow(r).getCell(1));
    if (PATTERNS.DIGIT_3.test(valA) || PATTERNS.CODE_433.test(valA)) break;
    if (PATTERNS.SINGLE_ALPHA.test(valA)) sumCells.push(`S${r}`);
  }
  return sumCells.length > 0 ? `SUM(${sumCells.join(',')})` : null;
}

function createSumFor433Code(worksheet, startRow) {
  const sumCells = [];
  const total = worksheet.rowCount;
  for (let r = startRow + 1; r <= total; r++) {
    const valA = getCellText(worksheet.getRow(r).getCell(1));
    if (PATTERNS.CODE_433.test(valA) || PATTERNS.CODE_43.test(valA)) break;
    if (PATTERNS.DIGIT_3.test(valA)) sumCells.push(`S${r}`);
  }
  return sumCells.length > 0 ? `SUM(${sumCells.join(',')})` : null;
}

function createSumFor43Code(worksheet, startRow) {
  const sumCells = [];
  const total = worksheet.rowCount;
  for (let r = startRow + 1; r <= total; r++) {
    const valA = getCellText(worksheet.getRow(r).getCell(1));
    if (PATTERNS.CODE_43.test(valA) || PATTERNS.DIGIT_4.test(valA)) break;
    if (PATTERNS.CODE_433.test(valA)) sumCells.push(`S${r}`);
  }
  return sumCells.length > 0 ? `SUM(${sumCells.join(',')})` : null;
}

function createSumFor4Digit(worksheet, startRow) {
  const sumCells = [];
  const total = worksheet.rowCount;
  for (let r = startRow + 1; r <= total; r++) {
    const valA = getCellText(worksheet.getRow(r).getCell(1));
    if (PATTERNS.DIGIT_4.test(valA) || PATTERNS.CODE_322.test(valA)) break;
    if (PATTERNS.CODE_43.test(valA)) sumCells.push(`S${r}`);
  }
  return sumCells.length > 0 ? `SUM(${sumCells.join(',')})` : null;
}

function createSumFor322Code(worksheet, startRow) {
  const sumCells = [];
  const total = worksheet.rowCount;
  for (let r = startRow + 1; r <= total; r++) {
    const valA = getCellText(worksheet.getRow(r).getCell(1));
    if (PATTERNS.CODE_322.test(valA)) break;
    if (PATTERNS.DIGIT_4.test(valA)) sumCells.push(`S${r}`);
  }
  return sumCells.length > 0 ? `SUM(${sumCells.join(',')})` : null;
}

module.exports = formulas;
