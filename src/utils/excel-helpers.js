/**
 * Shared helper functions for ExcelJS operations
 */

function getCellText(cell) {
  if (!cell) return '';
  // In ExcelJS, slave cells of a merged range have cell.master pointing to top-left cell
  if (cell.isMerged && cell.master && cell.master !== cell) {
    return ''; // Skip slave cells of merged range
  }
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.richText) return val.richText.map((r) => r.text || '').join('').trim();
    if (val.result !== undefined && val.result !== null) return String(val.result).trim();
    if (val.text) return String(val.text).trim();
    if (val.formula) return String(val.result || '').trim();
  }
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  return String(val).trim();
}

function applyRange(worksheet, rowStart, rowEnd, colStart, colEnd, applyFn) {
  for (let r = rowStart; r <= rowEnd; r++) {
    const row = worksheet.getRow(r);
    for (let c = colStart; c <= colEnd; c++) {
      applyFn(row.getCell(c), r, c);
    }
  }
}

function outsideBorder(worksheet, rowStart, rowEnd, colStart, colEnd, colorArgb = 'FF000000') {
  const borderStyle = { style: 'thin', color: { argb: colorArgb } };

  for (let r = rowStart; r <= rowEnd; r++) {
    const row = worksheet.getRow(r);
    for (let c = colStart; c <= colEnd; c++) {
      const cell = row.getCell(c);
      const current = cell.border || {};
      cell.border = {
        ...current,
        top: r === rowStart ? borderStyle : current.top,
        bottom: r === rowEnd ? borderStyle : current.bottom,
        left: c === colStart ? borderStyle : current.left,
        right: c === colEnd ? borderStyle : current.right,
      };
    }
  }
}

function bottomBorder(worksheet, rowStart, rowEnd, colStart, colEnd, colorArgb = 'FF000000') {
  const borderStyle = { style: 'thin', color: { argb: colorArgb } };
  for (let r = rowStart; r <= rowEnd; r++) {
    const row = worksheet.getRow(r);
    for (let c = colStart; c <= colEnd; c++) {
      const cell = row.getCell(c);
      cell.border = { ...(cell.border || {}), bottom: borderStyle };
    }
  }
}

function unwrapTextValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return text
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  getCellText,
  applyRange,
  outsideBorder,
  bottomBorder,
  unwrapTextValue,
};
