const { applyRange, outsideBorder, bottomBorder, getCellText } = require('../utils/excel-helpers');
const PATTERNS = require('../utils/patterns');

/**
 * Step 5: Full formatting & styling (Font Arial 6pt, row color coding, header fills, borders, column widths)
 * @param {ExcelJS.Workbook} workbook
 */
async function styling(workbook) {
  workbook.worksheets.forEach((worksheet) => {
    // 1. Data font Arial 6pt for all data rows (row 4 onwards)
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber >= 4) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = {
            ...(cell.font || {}),
            name: 'Arial',
            size: 6,
          };
        });
      }
    });

    // 2. Color coding & bold formatting based on Column A
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 4) return;
      const cellA = row.getCell(1);
      const valA = getCellText(cellA);

      if (PATTERNS.CODE_322.test(valA)) {
        // Dark Blue #0c0c5e
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { ...(cell.font || {}), color: { argb: 'FF0c0c5e' } };
        });
      } else if (PATTERNS.DIGIT_4.test(valA)) {
        // Blue #0000FF
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { ...(cell.font || {}), color: { argb: 'FF0000FF' } };
        });
      } else if (PATTERNS.CODE_43.test(valA)) {
        // Red #B10301
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { ...(cell.font || {}), color: { argb: 'FFB10301' } };
        });
      } else if (PATTERNS.CODE_433.test(valA) || PATTERNS.DIGIT_3.test(valA)) {
        // Bold
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { ...(cell.font || {}), bold: true };
        });
      }
    });

    // 3. Header styling (Rows 1-3)
    // A1:AN2 -> Fill #0070C0, font Calibri, white text
    applyRange(worksheet, 1, 2, 1, 40, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
      cell.font = { name: 'Calibri', color: { argb: 'FFFFFFFF' } };
    });

    // A3:AN3 -> Fill #BFBFBF, font Calibri
    applyRange(worksheet, 3, 3, 1, 40, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
      cell.font = { name: 'Calibri', color: { argb: 'FF000000' } };
    });

    // Font sizes: Row 1 = 12, Row 2 = 10, Row 3 = 9
    applyRange(worksheet, 1, 1, 1, 40, (cell) => (cell.font.size = 12));
    applyRange(worksheet, 2, 2, 1, 40, (cell) => (cell.font.size = 10));
    applyRange(worksheet, 3, 3, 1, 40, (cell) => (cell.font.size = 9));

    // AO1:AO3 (SELISIH header) -> Fill #FFFF00, font Calibri 12pt Red
    applyRange(worksheet, 1, 3, 41, 41, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      cell.font = { name: 'Calibri', size: 12, color: { argb: 'FFFF0000' }, bold: true };
    });

    // Header alignment: center, middle, wrapText
    applyRange(worksheet, 1, 3, 1, 41, (cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // 4. Header Borders
    // White border A1:AN2
    applyRange(worksheet, 1, 2, 1, 40, (cell) => {
      const whiteBorder = { style: 'thin', color: { argb: 'FFFFFFFF' } };
      cell.border = { top: whiteBorder, bottom: whiteBorder, left: whiteBorder, right: whiteBorder };
    });

    // Black border A3:AN3 and AO1:AO3
    applyRange(worksheet, 3, 3, 1, 40, (cell) => {
      const blackBorder = { style: 'thin', color: { argb: 'FF000000' } };
      cell.border = { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder };
    });
    applyRange(worksheet, 1, 3, 41, 41, (cell) => {
      const blackBorder = { style: 'thin', color: { argb: 'FF000000' } };
      cell.border = { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder };
    });

    // 5. Data Outside Borders (Row 4 to XX)
    let lastRow = 4;
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

        if (isTableRow) lastRow = Math.max(lastRow, rowNumber);
      }
    });

    const XX = lastRow;

    outsideBorder(worksheet, 4, XX, 1, 20);
    outsideBorder(worksheet, 4, XX, 21, 40);
    outsideBorder(worksheet, 4, XX, 41, 41);

    // Bottom border AXX:AOXX
    bottomBorder(worksheet, XX, XX, 1, 41);

    // 6. Signature Block Styling (ONLY for rows r > XX)
    const maxR = worksheet.rowCount;
    for (let r = XX + 1; r <= maxR; r++) {
      const cellAL = worksheet.getRow(r).getCell(38);
      const txt = getCellText(cellAL);
      if (txt) {
        cellAL.alignment = { horizontal: 'center', vertical: 'middle' };
        const isName = !txt.includes('Jakarta') && !txt.includes('NIP');
        cellAL.font = {
          name: 'Arial',
          size: 6,
          bold: isName,
          underline: isName,
        };
      }
    }

    // 7. Set column widths (20-column RAB format layout)
    const widths = {
      1: 12, // A - KODE
      2: 35, // B - URAIAN
      3: 8,  // C - VOL RO
      4: 12, // D - JENIS KOMPONEN
      5: 4,  // E - Vol 1
      6: 6.5, // F - Sat 1
      7: 2.5, // G - x
      8: 4,  // H - Vol 2
      9: 6.5, // I - Sat 2
      10: 2.5, // J - x
      11: 4,  // K - Vol 3
      12: 6.5, // L - Sat 3
      13: 2.5, // M - x
      14: 4,  // N - Vol 4
      15: 6.5, // O - Sat 4
      16: 8,  // P - VOL
      17: 8,  // Q - SAT
      18: 12, // R - HARGASAT
      19: 14, // S - JUMLAH
      20: 8,  // T - TAGGING RM/PNBP
    };

    // Apply widths for SEMULA (1..20) and MENJADI (21..40)
    for (let c = 1; c <= 20; c++) {
      const w = widths[c] || 8;
      const colSemula = worksheet.getColumn(c);
      const colMenjadi = worksheet.getColumn(20 + c);
      colSemula.width = w;
      colMenjadi.width = w;
    }
    worksheet.getColumn(41).width = 14; // AO SELISIH
  });
}

module.exports = styling;
