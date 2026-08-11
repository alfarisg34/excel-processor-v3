const ExcelJS = require('exceljs');
const { getCellText } = require('../utils/excel-helpers');
const PATTERNS = require('../utils/patterns');

/**
 * Helper to update formula row references when rows shift down by rowOffset
 */
function shiftFormulaRows(formula, rowOffset) {
  if (!formula) return formula;
  return formula.replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
    const newRow = parseInt(row, 10) + rowOffset;
    return `${col}${newRow}`;
  });
}

/**
 * Helper to shift column letters in formulas by colOffset
 */
function shiftFormulaColumns(formula, colOffset) {
  if (!formula) return formula;
  return formula.replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
    let colIdx = 0;
    for (let i = 0; i < col.length; i++) {
      colIdx = colIdx * 26 + (col.charCodeAt(i) - 64);
    }
    const newColIdx = colIdx + colOffset;
    let newCol = '';
    let temp = newColIdx;
    while (temp > 0) {
      let m = (temp - 1) % 26;
      newCol = String.fromCharCode(65 + m) + newCol;
      temp = Math.floor((temp - m) / 26);
    }
    return `${newCol}${row}`;
  });
}

/**
 * Helper to get hierarchy level of budget code
 */
function getCodeLevel(code) {
  if (!code) return 99;
  if (PATTERNS.CODE_322.test(code)) return 1;
  if (PATTERNS.DIGIT_4.test(code)) return 2;
  if (PATTERNS.CODE_43.test(code)) return 3;
  if (PATTERNS.CODE_433.test(code)) return 4;
  if (PATTERNS.DIGIT_3.test(code)) return 5;
  if (PATTERNS.SINGLE_ALPHA.test(code)) return 6;
  if (PATTERNS.DIGIT_6.test(code)) return 7;
  if (code === '>') return 8;
  if (code === '>>') return 9;
  if (code === '-') return 10;
  return 99;
}

/**
 * Recalculate all formulas directly on output worksheet to guarantee 100% mathematical accuracy
 */
function generateOutSheetFormulas(worksheet) {
  const maxR = worksheet.rowCount;

  // 1. First pass: Detail row formulas (volume in P / AJ, jumlah in S / AM)
  for (let r = 4; r <= maxR; r++) {
    const row = worksheet.getRow(r);
    const code = getCellText(row.getCell(1)).trim();

    if (PATTERNS.CODE_433.test(code)) {
      row.getCell(3).value = { formula: `P${r}` };
      row.getCell(23).value = { formula: `AJ${r}` };
    }

    if (code === '-' || code === '>' || code === '>>') {
      const vol1 = getCellText(row.getCell(5));
      const vol2 = getCellText(row.getCell(8));
      const vol3 = getCellText(row.getCell(11));
      const vol4 = getCellText(row.getCell(14));

      // SEMULA Volume (Col P / 16) - Dynamic PRODUCT formula
      if (vol1 || vol2 || vol3 || vol4) {
        row.getCell(16).value = { formula: `PRODUCT(E${r},H${r},K${r},N${r})` };
      }

      // SEMULA Jumlah (Col S / 19)
      const hargasatS = getCellText(row.getCell(18));
      if (hargasatS) {
        row.getCell(19).value = { formula: `P${r}*R${r}` };
      }

      // MENJADI Volume (Col AJ / 36) - Dynamic PRODUCT formula
      const mVol1 = getCellText(row.getCell(25));
      const mVol2 = getCellText(row.getCell(28));
      const mVol3 = getCellText(row.getCell(31));
      const mVol4 = getCellText(row.getCell(34));

      if (mVol1 || mVol2 || mVol3 || mVol4) {
        row.getCell(36).value = { formula: `PRODUCT(Y${r},AB${r},AE${r},AH${r})` };
      }

      // MENJADI Jumlah (Col AM / 39)
      const hargasatM = getCellText(row.getCell(38));
      if (hargasatM) {
        row.getCell(39).value = { formula: `AJ${r}*AL${r}` };
      }
    }
  }

  // 2. Second pass: Bottom-up hierarchical SUM formulas for header codes
  const codeRows = [];
  for (let r = 4; r <= maxR; r++) {
    const row = worksheet.getRow(r);
    const code = getCellText(row.getCell(1)).trim();
    if (code) {
      codeRows.push({ rowNumber: r, code });
    }
  }

  for (let i = codeRows.length - 1; i >= 0; i--) {
    const curr = codeRows[i];
    const level = getCodeLevel(curr.code);

    if (level < 10) {
      const childRows = [];
      for (let j = i + 1; j < codeRows.length; j++) {
        const next = codeRows[j];
        const nextLevel = getCodeLevel(next.code);

        if (nextLevel <= level) break; // Reached same or higher level sibling
        childRows.push({ rowNumber: next.rowNumber, level: nextLevel });
      }

      if (childRows.length > 0) {
        let directChildren = [];

        if (level === 7) {
          // Special case for 6-Digit codes: Collect direct '-' details (before any '>') AND '>' / '>>' sub-groups
          let inSubGroup = false;
          for (const cr of childRows) {
            if (cr.level === 8 || cr.level === 9) {
              directChildren.push(cr.rowNumber);
              inSubGroup = true;
            } else if (cr.level === 10) {
              if (!inSubGroup) {
                directChildren.push(cr.rowNumber);
              }
            }
          }
        } else {
          // Standard hierarchical headers (Code 322, 4-Digit, Code 43, Code 433, 3-Digit, Single Alpha):
          // Pick descendants with minimum child level
          let minChildLevel = Infinity;
          for (const cr of childRows) {
            if (cr.level < minChildLevel) minChildLevel = cr.level;
          }
          directChildren = childRows
            .filter((cr) => cr.level === minChildLevel)
            .map((cr) => cr.rowNumber);
        }

        if (directChildren.length > 0) {
          const formS = `SUM(${directChildren.map((r) => `S${r}`).join(',')})`;
          const formAM = `SUM(${directChildren.map((r) => `AM${r}`).join(',')})`;

          worksheet.getRow(curr.rowNumber).getCell(19).value = { formula: formS };
          worksheet.getRow(curr.rowNumber).getCell(39).value = { formula: formAM };
        }
      }
    }
  }

  // 3. Third pass: SELISIH formulas in Col AO (41) = AM{r} - S{r}
  for (let r = 4; r <= maxR; r++) {
    const row = worksheet.getRow(r);
    const valS = row.getCell(19).value;
    const valAM = row.getCell(39).value;

    const hasS = valS !== null && valS !== undefined && valS !== '';
    const hasAM = valAM !== null && valAM !== undefined && valAM !== '';

    if (hasS || hasAM) {
      row.getCell(41).value = { formula: `AM${r}-S${r}` };
    }
  }
}

/**
 * Remove rows where both S and AM are blank, then re-generate formulas to prevent broken references
 */
function removeBlankSamRows(worksheet) {
  // First pass formulas so header code rows receive their SUM formulas
  generateOutSheetFormulas(worksheet);

  // Find rows where both S and AM are blank
  const rowsToDelete = [];
  const maxR = worksheet.rowCount;

  for (let r = 4; r <= maxR; r++) {
    const row = worksheet.getRow(r);
    const valS = row.getCell(19).value;
    const valAM = row.getCell(39).value;

    const hasS = valS !== null && valS !== undefined && valS !== '';
    const hasAM = valAM !== null && valAM !== undefined && valAM !== '';

    if (!hasS && !hasAM) {
      rowsToDelete.push(r);
    }
  }

  // Delete from bottom to top so indices remain consistent during deletion
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    const r = rowsToDelete[i];
    worksheet.getRow(r).values = [];
    worksheet.spliceRows(r, 1);
  }

  // Re-generate formulas with updated row numbers to ensure zero broken references
  generateOutSheetFormulas(worksheet);
}

/**
 * Step 4: Map intermediate data to RAB 20-column format + SEMULA/MENJADI/SELISIH + Summary columns
 * @param {ExcelJS.Workbook} inWorkbook
 * @returns {Promise<ExcelJS.Workbook>} Output workbook
 */
async function mapToRab(inWorkbook) {
  const outWorkbook = new ExcelJS.Workbook();

  inWorkbook.worksheets.forEach((inSheet) => {
    const sheetName = inSheet.name || 'Sheet1';
    const outSheet = outWorkbook.addWorksheet(sheetName);

    // 1. Collect all 20-column data rows from intermediate input worksheet
    const rawRows = [];
    const maxRow = inSheet.rowCount;

    for (let r = 1; r <= maxRow; r++) {
      const row = inSheet.getRow(r);
      const rowData = [];
      for (let c = 1; c <= 20; c++) {
        const cell = row.getCell(c);
        rowData.push({
          v: cell.value,
          f: cell.formula,
        });
      }

      const hasContent = rowData.some(
        (item) => item.v !== null && item.v !== undefined && item.v !== ''
      );

      const codeVal = (rowData[0].v || '').toString().trim();
      const uraianVal = (rowData[1].v || '').toString().trim();

      if (hasContent && (codeVal || uraianVal)) {
        rawRows.push(rowData);
      }
    }

    // 2. Build Header (Rows 1-3)
    // Row 1: SEMULA (Cols A-T / 1-20), MENJADI (Cols U-AN / 21-40), SELISIH (Col AO / 41)
    const row1 = new Array(65).fill('');
    row1[0] = 'SEMULA';
    row1[20] = 'MENJADI';
    row1[40] = 'SELISIH';
    outSheet.addRow(row1);

    // Row 2: Titles for SEMULA (A-T) and MENJADI (U-AN)
    const row2 = new Array(65).fill('');
    row2[0] = 'KODE';
    row2[1] = 'URAIAN';
    row2[2] = 'VOL RO';
    row2[3] = 'JENIS KOMPONEN (UTAMA/ PENDUKUNG)';
    row2[4] = 'Rincian Perhitungan';
    row2[15] = 'VOL';
    row2[16] = 'SAT';
    row2[17] = 'HARGASAT';
    row2[18] = 'JUMLAH';
    row2[19] = 'TAGGING RM/ PNBP';

    row2[20] = 'KODE';
    row2[21] = 'URAIAN';
    row2[22] = 'VOL RO';
    row2[23] = 'JENIS KOMPONEN (UTAMA/ PENDUKUNG)';
    row2[24] = 'Rincian Perhitungan';
    row2[35] = 'VOL';
    row2[36] = 'SAT';
    row2[37] = 'HARGASAT';
    row2[38] = 'JUMLAH';
    row2[39] = 'TAGGING RM/ PNBP';

    row2[40] = 'SELISIH';
    outSheet.addRow(row2);

    // Row 3: Column Numbers (1-10 for SEMULA and MENJADI)
    const row3 = new Array(65).fill('');
    row3[0] = '1';
    row3[1] = '2';
    row3[2] = '3';
    row3[3] = '4';
    row3[4] = '5';
    row3[15] = '6';
    row3[16] = '7';
    row3[17] = '8';
    row3[18] = '9';
    row3[19] = '10';

    row3[20] = '1';
    row3[21] = '2';
    row3[22] = '3';
    row3[23] = '4';
    row3[24] = '5';
    row3[35] = '6';
    row3[36] = '7';
    row3[37] = '8';
    row3[38] = '9';
    row3[39] = '10';

    row3[40] = 'SELISIH';
    outSheet.addRow(row3);

    // Merge header ranges including E2:O2, Y2:AI2, E3:O3, Y3:AI3
    const mergeRanges = [
      'A1:T1',
      'U1:AN1',
      'AO1:AO3',
      'E2:O2',
      'Y2:AI2',
      'E3:O3',
      'Y3:AI3',
    ];

    mergeRanges.forEach((rangeStr) => {
      try {
        outSheet.mergeCells(rangeStr);
      } catch (e) {
        // Ignore merge collisions
      }
    });

    // 3. Append Data Rows (Row 4 onwards)
    const rowOffset = 3;

    rawRows.forEach((rowItems) => {
      const targetRow = new Array(65).fill('');

      // Populate SEMULA (Cols 1..20 / A..T, indices 0..19)
      for (let c = 0; c <= 19; c++) {
        const item = rowItems[c];
        if (!item) continue;
        if (item.f) {
          targetRow[c] = { formula: shiftFormulaRows(item.f, rowOffset) };
        } else {
          targetRow[c] = item.v;
        }
      }

      // Mirror to MENJADI (Cols 21..40 / U..AN, indices 20..39)
      for (let c = 0; c <= 19; c++) {
        const val = targetRow[c];
        if (val && typeof val === 'object' && val.formula) {
          targetRow[20 + c] = { formula: shiftFormulaColumns(val.formula, 20) };
        } else {
          targetRow[20 + c] = val;
        }
      }

      outSheet.addRow(targetRow);
    });

    // 4. Delete all rows after bottom-most table row n
    cleanupBottomRows(outSheet);

    // 5. Remove rows where both S and AM are blank, then re-generate all formulas
    removeBlankSamRows(outSheet);

    // 6. Add Summary Columns
    populateSummaryColumns(outSheet);

    // 7. Append signature block starting at Col AL (38), Row n+2 (with +2 extra rows for TTE barcode)
    const n = outSheet.rowCount;
    const sig = inSheet.signatureInfo || {};
    const dateText = sig.dateLine || 'Jakarta Selatan, 31 Juli 2026';
    const nameText = sig.nameLine || 'NURYANTI';
    const nipText = sig.nipLine || 'NIP 197601041999022002';

    // Row n+2: Date line at Col AL (38)
    outSheet.getRow(n + 2).getCell(38).value = dateText;
    outSheet.mergeCells(`AL${n + 2}:AN${n + 2}`);

    // Row n+8: Signee Name at Col AL (38) (5 spacing rows n+3..n+7 for TTE barcode)
    outSheet.getRow(n + 8).getCell(38).value = nameText;
    outSheet.mergeCells(`AL${n + 8}:AN${n + 8}`);

    // Row n+9: NIP Line at Col AL (38)
    outSheet.getRow(n + 9).getCell(38).value = nipText;
    outSheet.mergeCells(`AL${n + 9}:AN${n + 9}`);
  });

  return outWorkbook;
}

function cleanupBottomRows(worksheet) {
  let lastTableDataRow = 3;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber >= 4) {
      const valA = getCellText(row.getCell(1)).trim();
      const valB = getCellText(row.getCell(2)).trim();

      const isTableRow =
        valA === '-' ||
        valA === '>' ||
        valA === '>>' ||
        PATTERNS.CODE_322.test(valA) ||
        PATTERNS.DIGIT_4.test(valA) ||
        PATTERNS.CODE_43.test(valA) ||
        PATTERNS.CODE_433.test(valA) ||
        PATTERNS.DIGIT_3.test(valA) ||
        PATTERNS.SINGLE_ALPHA.test(valA) ||
        PATTERNS.DIGIT_6.test(valA) ||
        valB.startsWith('(KPPN') ||
        valB.startsWith('Lokasi');

      if (isTableRow) {
        lastTableDataRow = Math.max(lastTableDataRow, rowNumber);
      }
    }
  });

  const oldRowCount = worksheet.rowCount;
  if (oldRowCount > lastTableDataRow) {
    for (let r = lastTableDataRow + 1; r <= oldRowCount; r++) {
      worksheet.getRow(r).values = [];
    }
    worksheet.spliceRows(lastTableDataRow + 1, oldRowCount - lastTableDataRow);
  }
}

function populateSummaryColumns(worksheet) {
  const triggerRows = [];
  const rows524Semula = [];
  const rows524Menjadi = [];
  const rowsRMSemula = [];
  const rowsRMMenjadi = [];
  const rowsPNPSemula = [];
  const rowsPNPMenjadi = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 4) return;
    const valA = getCellText(row.getCell(1));
    const valU = getCellText(row.getCell(21));
    const valT = getCellText(row.getCell(20));
    const valAN = getCellText(row.getCell(40));

    if (
      PATTERNS.CODE_433.test(valA) ||
      PATTERNS.CODE_43.test(valA) ||
      PATTERNS.CODE_322.test(valA)
    ) {
      triggerRows.push(rowNumber);
    }

    if (PATTERNS.PREFIX_524.test(valA)) rows524Semula.push(rowNumber);
    if (PATTERNS.PREFIX_524.test(valU)) rows524Menjadi.push(rowNumber);

    if (valT === 'RM') rowsRMSemula.push(rowNumber);
    if (valAN === 'RM') rowsRMMenjadi.push(rowNumber);

    if (valT === 'PNP' || valT === 'PNBP') rowsPNPSemula.push(rowNumber);
    if (valAN === 'PNP' || valAN === 'PNBP') rowsPNPMenjadi.push(rowNumber);
  });

  triggerRows.forEach((Y) => {
    const nextY = triggerRows.find((r) => r > Y) || Infinity;

    // 524 SEMULA (col 42 / AP)
    worksheet.getRow(Y).getCell(42).value = '524 SEMULA';
    const inRange524S = rows524Semula.filter((r) => r > Y && r < nextY);
    const form524S = inRange524S.length > 0 ? inRange524S.map((r) => `S${r}`).join('+') : '0';
    worksheet.getRow(Y + 1).getCell(42).value = { formula: form524S };

    // 524 MENJADI (col 43 / AQ)
    worksheet.getRow(Y).getCell(43).value = '524 MENJADI';
    const inRange524M = rows524Menjadi.filter((r) => r > Y && r < nextY);
    const form524M = inRange524M.length > 0 ? inRange524M.map((r) => `AM${r}`).join('+') : '0';
    worksheet.getRow(Y + 1).getCell(43).value = { formula: form524M };

    // SELISIH 524 (col 44 / AR)
    worksheet.getRow(Y).getCell(44).value = 'SELISIH';
    worksheet.getRow(Y + 1).getCell(44).value = { formula: `AQ${Y + 1}-AP${Y + 1}` };

    // RM SEMULA (col 45 / AS)
    worksheet.getRow(Y).getCell(45).value = 'RM SEMULA';
    const inRangeRMS = rowsRMSemula.filter((r) => r > Y && r < nextY);
    const formRMS = inRangeRMS.length > 0 ? inRangeRMS.map((r) => `S${r}`).join('+') : '0';
    worksheet.getRow(Y + 1).getCell(45).value = { formula: formRMS };

    // RM MENJADI (col 46 / AT)
    worksheet.getRow(Y).getCell(46).value = 'RM MENJADI';
    const inRangeRMM = rowsRMMenjadi.filter((r) => r > Y && r < nextY);
    const formRMM = inRangeRMM.length > 0 ? inRangeRMM.map((r) => `AM${r}`).join('+') : '0';
    worksheet.getRow(Y + 1).getCell(46).value = { formula: formRMM };

    // SELISIH RM (col 47 / AU)
    worksheet.getRow(Y).getCell(47).value = 'SELISIH';
    worksheet.getRow(Y + 1).getCell(47).value = { formula: `AT${Y + 1}-AS${Y + 1}` };

    // PNBP SEMULA (col 48 / AV)
    worksheet.getRow(Y).getCell(48).value = 'PNBP SEMULA';
    const inRangePNPS = rowsPNPSemula.filter((r) => r > Y && r < nextY);
    const formPNPS = inRangePNPS.length > 0 ? inRangePNPS.map((r) => `S${r}`).join('+') : '0';
    worksheet.getRow(Y + 1).getCell(48).value = { formula: formPNPS };

    // PNBP MENJADI (col 49 / AW)
    worksheet.getRow(Y).getCell(49).value = 'PNBP MENJADI';
    const inRangePNPM = rowsPNPMenjadi.filter((r) => r > Y && r < nextY);
    const formPNPM = inRangePNPM.length > 0 ? inRangePNPM.map((r) => `AM${r}`).join('+') : '0';
    worksheet.getRow(Y + 1).getCell(49).value = { formula: formPNPM };

    // SELISIH PNBP (col 50 / AX)
    worksheet.getRow(Y).getCell(50).value = 'SELISIH';
    worksheet.getRow(Y + 1).getCell(50).value = { formula: `AW${Y + 1}-AV${Y + 1}` };
  });
}

module.exports = mapToRab;
