const parseInput = require('./01-parse-input');
const { getCellText } = require('../utils/excel-helpers');
const PATTERNS = require('../utils/patterns');

/**
 * Get hierarchy level of budget code
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
  if (code === '>' || code === '>>' || code === '-') return 10;
  return 99;
}

/**
 * Validates hierarchy pattern and duplicate rules for RINCIAN KERTAS KERJA SATKER file buffer.
 *
 * Rules:
 * Rule 1: Code 322 (global duplicate check)
 * Rule 2: Digit 4 (global duplicate check)
 * Rule 3: Code 43 (global duplicate check)
 * Rule 4: Code 433 (global duplicate check)
 * Rule 5: Digit 3 duplicate under the same Code 433 parent
 * Rule 6: Single Alpha duplicate under the same Digit 3 parent
 * Rule 7: Digit 6 duplicate under the same Single Alpha parent, EXCEPT if column L (sumber anggaran RM vs PNP/PNBP) is different.
 *
 * @param {Buffer} buffer - File buffer of RINCIAN KERTAS KERJA SATKER
 * @returns {Promise<{ valid: boolean, violations: Array }>}
 */
async function validateInput(buffer) {
  const workbook = await parseInput(buffer);
  const worksheet = workbook.worksheets[0]; // Process 1st worksheet

  const code322Map = new Map();     // code -> list of { row, val }
  const digit4Map = new Map();      // code -> list of { row, val }
  const code43Map = new Map();      // code -> list of { row, val }
  const code433Map = new Map();     // code -> list of { row, val }
  const digit3Map = new Map();      // parent433Code -> Map(digit3Code -> list of { row, val })
  const singleAlphaMap = new Map(); // parentDigit3Key (parent433+digit3) -> Map(alpha -> list of { row, val })
  const digit6Map = new Map();      // parentAlphaKey (parent433+digit3+alpha) -> Map(digit6 -> list of { row, tagging, val })

  // Context trackers as we iterate rows
  let current433 = null;
  let currentDigit3 = null;
  let currentAlpha = null;

  let lastCode = null;
  let lastRow = null;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const code = getCellText(row.getCell(1)).trim();
    if (!code) return;

    const isConsecutiveSameCode = (code === lastCode && rowNumber === lastRow + 1);
    lastCode = code;
    lastRow = rowNumber;

    const level = getCodeLevel(code);

    if (isConsecutiveSameCode) {
      // Multi-line header continuation row (e.g. 2175.QEA.002 on consecutive rows 558 & 559)
      return;
    }

    // Extract tagging / sumber anggaran from Column L (12th column in input) or nearby tagging candidates
    const colLRaw = getCellText(row.getCell(12)).trim().toUpperCase();
    let tagging = '';
    if (colLRaw.includes('RM')) tagging = 'RM';
    else if (colLRaw.includes('PNP') || colLRaw.includes('PNBP')) tagging = 'PNBP';
    else {
      // Fallback check columns 10-15 if shifted
      for (let c = 10; c <= 15; c++) {
        const t = getCellText(row.getCell(c)).trim().toUpperCase();
        if (t === 'RM' || t === 'PNBP' || t === 'PNP') {
          tagging = t === 'PNP' ? 'PNBP' : t;
          break;
        }
      }
    }

    // Reset hierarchy scope based on code level
    if (level <= 4) {
      current433 = level === 4 ? code : null;
      currentDigit3 = null;
      currentAlpha = null;
    } else if (level === 5) {
      currentDigit3 = code;
      currentAlpha = null;
    } else if (level === 6) {
      currentAlpha = code;
    }

    // Rule 1: Code 322
    if (PATTERNS.CODE_322.test(code)) {
      if (!code322Map.has(code)) code322Map.set(code, []);
      code322Map.get(code).push({ row: rowNumber, val: code });
    }

    // Rule 2: Digit 4
    if (PATTERNS.DIGIT_4.test(code)) {
      if (!digit4Map.has(code)) digit4Map.set(code, []);
      digit4Map.get(code).push({ row: rowNumber, val: code });
    }

    // Rule 3: Code 43
    if (PATTERNS.CODE_43.test(code)) {
      if (!code43Map.has(code)) code43Map.set(code, []);
      code43Map.get(code).push({ row: rowNumber, val: code });
    }

    // Rule 4: Code 433
    if (PATTERNS.CODE_433.test(code)) {
      if (!code433Map.has(code)) code433Map.set(code, []);
      code433Map.get(code).push({ row: rowNumber, val: code });
    }

    // Rule 5: Digit 3 under same Code 433
    if (PATTERNS.DIGIT_3.test(code)) {
      const parentKey = current433 || 'NO_PARENT_433';
      if (!digit3Map.has(parentKey)) digit3Map.set(parentKey, new Map());
      const pMap = digit3Map.get(parentKey);
      if (!pMap.has(code)) pMap.set(code, []);
      pMap.get(code).push({ row: rowNumber, val: code, parent: parentKey });
    }

    // Rule 6: Single Alpha under same Digit 3
    if (PATTERNS.SINGLE_ALPHA.test(code)) {
      const parentKey = (current433 || 'NO_PARENT_433') + ' > ' + (currentDigit3 || 'NO_PARENT_DIGIT3');
      if (!singleAlphaMap.has(parentKey)) singleAlphaMap.set(parentKey, new Map());
      const pMap = singleAlphaMap.get(parentKey);
      if (!pMap.has(code)) pMap.set(code, []);
      pMap.get(code).push({ row: rowNumber, val: code, parent: parentKey });
    }

    // Rule 7: Digit 6 under same Single Alpha
    if (PATTERNS.DIGIT_6.test(code)) {
      const parentKey = (current433 || 'NO_PARENT_433') + ' > ' + (currentDigit3 || 'NO_PARENT_DIGIT3') + ' > ' + (currentAlpha || 'NO_PARENT_ALPHA');
      if (!digit6Map.has(parentKey)) digit6Map.set(parentKey, new Map());
      const pMap = digit6Map.get(parentKey);
      if (!pMap.has(code)) pMap.set(code, []);
      pMap.get(code).push({ row: rowNumber, val: code, tagging, parent: parentKey });
    }
  });

  const violations = [];

  // Helper to add global violations
  function checkGlobalDuplicates(map, ruleId, ruleTitle, patternDesc) {
    const dups = [];
    for (const [code, items] of map.entries()) {
      if (items.length > 1) {
        dups.push({
          code,
          rows: items.map((i) => i.row),
          count: items.length,
          context: 'Global (Seluruh Worksheet)',
        });
      }
    }
    if (dups.length > 0) {
      violations.push({
        ruleId,
        ruleTitle,
        patternDesc,
        details: dups,
      });
    }
  }

  // Check Rules 1 - 4
  checkGlobalDuplicates(code322Map, 1, 'Duplikat Code 322', 'Format 322 (contoh: 026.04.DN)');
  checkGlobalDuplicates(digit4Map, 2, 'Duplikat Digit 4', 'Format 4 Digit (contoh: 2175)');
  checkGlobalDuplicates(code43Map, 3, 'Duplikat Code 43', 'Format 43 (contoh: 2175.BDC)');
  checkGlobalDuplicates(code433Map, 4, 'Duplikat Code 433', 'Format 433 (contoh: 2175.BDC.001)');

  // Rule 5: Digit 3 under same Code 433
  const r5Dups = [];
  for (const [parent433, pMap] of digit3Map.entries()) {
    for (const [code, items] of pMap.entries()) {
      if (items.length > 1) {
        r5Dups.push({
          code,
          rows: items.map((i) => i.row),
          count: items.length,
          context: `Di bawah Code 433: ${parent433}`,
        });
      }
    }
  }
  if (r5Dups.length > 0) {
    violations.push({
      ruleId: 5,
      ruleTitle: 'Duplikat Digit 3 di bawah Code 433 yang Sama',
      patternDesc: 'Format 3 Digit (contoh: 051) di bawah parent 433',
      details: r5Dups,
    });
  }

  // Rule 6: Single Alpha under same Digit 3
  const r6Dups = [];
  for (const [parentKey, pMap] of singleAlphaMap.entries()) {
    for (const [code, items] of pMap.entries()) {
      if (items.length > 1) {
        r6Dups.push({
          code,
          rows: items.map((i) => i.row),
          count: items.length,
          context: `Di bawah Parent: ${parentKey}`,
        });
      }
    }
  }
  if (r6Dups.length > 0) {
    violations.push({
      ruleId: 6,
      ruleTitle: 'Duplikat Single Alpha di bawah Digit 3 yang Sama',
      patternDesc: 'Single Alpha (contoh: A, B) di bawah parent Digit 3',
      details: r6Dups,
    });
  }

  // Rule 7: Digit 6 under same Single Alpha (check column L tagging)
  const r7Dups = [];
  for (const [parentKey, pMap] of digit6Map.entries()) {
    for (const [code, items] of pMap.entries()) {
      if (items.length > 1) {
        // Check if all items have identical non-empty taggings (or if any tagging is identical)
        const taggings = items.map((i) => i.tagging);
        const uniqueTaggings = new Set(taggings.filter(Boolean));

        // If they have identical tagging or tagging is missing/same, it's a violation!
        // It is only allowed if they have DIFFERENT budget sources (e.g., one is RM and one is PNP/PNBP)
        const hasConflict = items.some((item, idx) => {
          return items.some((other, oIdx) => {
            if (idx === oIdx) return false;
            // Conflict if taggings match or any is empty
            if (!item.tagging || !other.tagging) return true;
            return item.tagging === other.tagging;
          });
        });

        if (hasConflict) {
          r7Dups.push({
            code,
            rows: items.map((i) => i.row),
            count: items.length,
            taggings: items.map((i) => `Baris ${i.row}: ${i.tagging || 'Tidak ada tagging'}`).join(', '),
            context: `Di bawah Parent: ${parentKey}`,
          });
        }
      }
    }
  }
  if (r7Dups.length > 0) {
    violations.push({
      ruleId: 7,
      ruleTitle: 'Duplikat Digit 6 di bawah Single Alpha (Sumber Anggaran Sama/Kosong)',
      patternDesc: 'Format 6 Digit (contoh: 521211) dengan kode sumber anggaran (kolom L) yang sama',
      details: r7Dups,
    });
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

module.exports = validateInput;
