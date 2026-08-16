const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { getCellText } = require('../utils/excel-helpers');
const PATTERNS = require('../utils/patterns');

/**
 * Get hierarchy numeric order level
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
 * Helper to parse Laporan FA Detail (16 Segmen) with full multi-criteria hierarchy context
 * @param {Buffer} faBuffer
 * @returns {Promise<Array<{rawRowNum: number, program: string, kegiatan: string, kro: string, ro: string, fullRo: string, komponen: string, subkomponen: string, akun: string, uraian: string, pagu: number, sisa: number}>>}
 */
async function parseLaporanFA(faBuffer) {
  const faWorkbook = new ExcelJS.Workbook();
  const stream = Readable.from(faBuffer);
  await faWorkbook.xlsx.read(stream);

  const ws = faWorkbook.worksheets[0];
  const items = [];
  const ctx = { program: '', kegiatan: '', kro: '', ro: '', komponen: '', subkomponen: '', akun: '' };

  for (let r = 9; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const c2 = getCellText(row.getCell(2)).trim();
    const c3 = getCellText(row.getCell(3)).trim();
    const c5 = getCellText(row.getCell(5)).trim();
    const c6 = getCellText(row.getCell(6)).trim();
    const c8 = getCellText(row.getCell(8)).trim();
    const c14 = getCellText(row.getCell(14)).trim();

    // Read Sisa Anggaran strictly from Column 31
    const sisaRaw = row.getCell(31).value;
    let sisaNum = 0;
    if (typeof sisaRaw === 'number') {
      sisaNum = sisaRaw;
    } else if (sisaRaw !== null && sisaRaw !== undefined) {
      const resVal = (typeof sisaRaw === 'object' && sisaRaw.result !== undefined) ? sisaRaw.result : sisaRaw;
      const parsed = parseFloat(String(resVal).replace(/[^0-9.-]/g, ''));
      sisaNum = isNaN(parsed) ? 0 : parsed;
    }

    // Read Pagu strictly from Column 17
    const paguRaw = row.getCell(17).value;
    let paguNum = 0;
    if (typeof paguRaw === 'number') {
      paguNum = paguRaw;
    } else if (paguRaw !== null && paguRaw !== undefined) {
      const resVal = (typeof paguRaw === 'object' && paguRaw.result !== undefined) ? paguRaw.result : paguRaw;
      const parsed = parseFloat(String(resVal).replace(/[^0-9.-]/g, ''));
      paguNum = isNaN(parsed) ? 0 : parsed;
    }

    // Track hierarchy context from FA rows
    if (c2 && /^[A-Za-z]{2}$/.test(c2)) {
      ctx.program = c2;
      ctx.kegiatan = ''; ctx.kro = ''; ctx.ro = ''; ctx.komponen = ''; ctx.subkomponen = ''; ctx.akun = '';
    } else if (c2 && /^[A-Za-z]{2}\.\d{4}$/.test(c2)) {
      ctx.kegiatan = c2.replace(/^[A-Za-z]{2}\./, '');
      ctx.kro = ''; ctx.ro = ''; ctx.komponen = ''; ctx.subkomponen = ''; ctx.akun = '';
    }

    if (c3 && /^[A-Za-z0-9]{3}$/.test(c3)) {
      ctx.kro = c3;
      ctx.ro = ''; ctx.komponen = ''; ctx.subkomponen = ''; ctx.akun = '';
    } else if (c3 && /^[A-Za-z0-9]{3}\.\d{3}$/.test(c3)) {
      ctx.ro = c3;
      ctx.komponen = ''; ctx.subkomponen = ''; ctx.akun = '';
    }

    if (c5 && /^\d{3}$/.test(c5)) {
      ctx.komponen = c5;
      ctx.subkomponen = ''; ctx.akun = '';
    }

    if (c6 && (/^\d{3}\.0[A-Za-z]$/.test(c6) || /^\d{3}\.[A-Za-z0-9]{2}$/.test(c6))) {
      const m = c6.match(/\.0?([A-Za-z0-9]+)$/);
      ctx.subkomponen = m ? m[1] : c6;
      ctx.akun = '';
    }

    if (c8 && /^\d{6}$/.test(c8)) {
      ctx.akun = c8;
    }

    // Detail item row
    if (c14 && /^\d{6}\.\s*/.test(c14)) {
      const cleanUraian = c14.replace(/^\d{6}\.\s*/, '').replace(/\s+/g, ' ').trim();
      items.push({
        rawRowNum: r,
        program: ctx.program,
        kegiatan: ctx.kegiatan,
        kro: ctx.kro,
        ro: ctx.ro,
        fullRo: (ctx.kegiatan && ctx.ro) ? (ctx.kegiatan + '.' + ctx.ro) : ctx.ro,
        komponen: ctx.komponen,
        subkomponen: ctx.subkomponen,
        akun: ctx.akun,
        uraian: cleanUraian,
        pagu: paguNum,
        sisa: sisaNum
      });
    }
  }

  return items;
}

/**
 * Step 6: Match Laporan FA to worksheet detail rows and insert Sisa Anggaran in Column 42 (AP)
 * with multi-criteria hierarchy matching, hierarchical SUM across all levels, and unmatched items tracking.
 * @param {ExcelJS.Workbook} workbook
 * @param {Buffer} [faBuffer] - Optional Laporan FA file buffer
 * @returns {Promise<Object|null>} Matching summary report
 */
async function faMatching(workbook, faBuffer) {
  if (!faBuffer) {
    return null; // Optional step, skip if no FA file provided
  }

  const faData = await parseLaporanFA(faBuffer);
  if (!faData || faData.length === 0) {
    return null;
  }

  const faUsed = new Set();
  const matchedItems = [];
  const unmatchedItems = [];
  const blockedItems = [];
  let totalDetailCount = 0;
  let normalDetailCount = 0;

  workbook.worksheets.forEach((worksheet) => {
    // Target Column 42 (AP)
    const colFA = 42;

    // Set header at row 1 (master cell of merged AP1:AP3)
    worksheet.getRow(1).getCell(colFA).value = 'SISA ANGGARAN';

    const rkkCtx = { program: '', kegiatan: '', kro: '', ro: '', komponen: '', subkomponen: '', akun: '' };
    const maxR = worksheet.rowCount;

    // 1. Pass 1: Detail Row Matching (Row 4 onwards)
    for (let r = 4; r <= maxR; r++) {
      const row = worksheet.getRow(r);
      const code = getCellText(row.getCell(1)).trim();
      const uraian = getCellText(row.getCell(2)).trim();
      const valT = getCellText(row.getCell(20)).trim();
      const valAN = getCellText(row.getCell(40)).trim();
      const cleanUraian = uraian.replace(/\s*\[.*?(?:\]\s*)?$/, '').replace(/\s+/g, ' ').trim();
      const jumlahS = parseFloat(getCellText(row.getCell(19)).replace(/[^0-9.-]/g, '')) || 0;

      if (PATTERNS.CODE_322.test(code)) {
        const m = code.match(/\.([A-Za-z]{2})$/);
        rkkCtx.program = m ? m[1] : code;
        rkkCtx.kegiatan = ''; rkkCtx.kro = ''; rkkCtx.ro = ''; rkkCtx.komponen = ''; rkkCtx.subkomponen = ''; rkkCtx.akun = '';
      } else if (PATTERNS.DIGIT_4.test(code)) {
        rkkCtx.kegiatan = code;
        rkkCtx.kro = ''; rkkCtx.ro = ''; rkkCtx.komponen = ''; rkkCtx.subkomponen = ''; rkkCtx.akun = '';
      } else if (PATTERNS.CODE_43.test(code)) {
        const parts = code.split('.');
        rkkCtx.kro = parts[1] || code;
        rkkCtx.ro = ''; rkkCtx.komponen = ''; rkkCtx.subkomponen = ''; rkkCtx.akun = '';
      } else if (PATTERNS.CODE_433.test(code)) {
        const parts = code.split('.');
        rkkCtx.ro = parts.slice(1).join('.');
        rkkCtx.komponen = ''; rkkCtx.subkomponen = ''; rkkCtx.akun = '';
      } else if (PATTERNS.DIGIT_3.test(code)) {
        rkkCtx.komponen = code;
        rkkCtx.subkomponen = ''; rkkCtx.akun = '';
      } else if (PATTERNS.SINGLE_ALPHA.test(code)) {
        rkkCtx.subkomponen = code;
        rkkCtx.akun = '';
      } else if (PATTERNS.DIGIT_6.test(code)) {
        rkkCtx.akun = code;
      } else if (code === '-') {
        totalDetailCount++;

        // Rule: If Tagging RM/PNBP has '*', this is a blocked budget and will NOT exist in FA Detail
        const isBlocked = valT.includes('*') || valAN.includes('*');
        if (isBlocked) {
          row.getCell(colFA).value = 0;
          blockedItems.push({
            rowNumber: r,
            hierarchyPath: [rkkCtx.program, rkkCtx.kegiatan, rkkCtx.kro, rkkCtx.ro, rkkCtx.komponen, rkkCtx.subkomponen, rkkCtx.akun].filter(Boolean).join(' > '),
            uraian: cleanUraian,
            pagu: jumlahS,
            tagging: valT || valAN || '*',
            status: 'Anggaran Diblokir (Tagging *)'
          });
          continue;
        }

        normalDetailCount++;
        let foundIdx = -1;

        // Strict Hierarchy Matching:
        // Must strictly match Akun + Komponen + Subkomponen + RO + Uraian
        for (let i = 0; i < faData.length; i++) {
          if (faUsed.has(i)) continue;
          const fa = faData[i];
          const matchAkun = !rkkCtx.akun || !fa.akun || rkkCtx.akun === fa.akun;
          const matchKomp = !rkkCtx.komponen || !fa.komponen || rkkCtx.komponen === fa.komponen;
          const matchSub = !rkkCtx.subkomponen || !fa.subkomponen || rkkCtx.subkomponen.toUpperCase() === fa.subkomponen.toUpperCase();
          const matchRo = !rkkCtx.ro || !fa.ro || rkkCtx.ro === fa.ro || rkkCtx.ro.endsWith(fa.ro) || fa.ro.endsWith(rkkCtx.ro);
          const matchName = cleanUraian.toLowerCase() === fa.uraian.toLowerCase();

          if (matchAkun && matchKomp && matchSub && matchRo && matchName) {
            foundIdx = i;
            break;
          }
        }

        if (foundIdx !== -1) {
          faUsed.add(foundIdx);
          row.getCell(colFA).value = faData[foundIdx].sisa;
          matchedItems.push({
            rowNumber: r,
            hierarchyPath: [rkkCtx.program, rkkCtx.kegiatan, rkkCtx.kro, rkkCtx.ro, rkkCtx.komponen, rkkCtx.subkomponen, rkkCtx.akun].filter(Boolean).join(' > '),
            uraian: cleanUraian,
            pagu: jumlahS,
            sisa: faData[foundIdx].sisa
          });
        } else {
          row.getCell(colFA).value = 0;
          unmatchedItems.push({
            rowNumber: r,
            hierarchyPath: [rkkCtx.program, rkkCtx.kegiatan, rkkCtx.kro, rkkCtx.ro, rkkCtx.komponen, rkkCtx.subkomponen, rkkCtx.akun].filter(Boolean).join(' > '),
            uraian: cleanUraian,
            pagu: jumlahS,
            tagging: valT || valAN || '-',
            status: 'Tidak Ditemukan di FA'
          });
        }
      }
    }

    // 2. Pass 2: Bottom-up hierarchical SUM in Column AP (42) for all header codes (from level 6-digit to 322)
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
          if (nextLevel <= level) break;
          childRows.push({ rowNumber: next.rowNumber, level: nextLevel });
        }

        if (childRows.length > 0) {
          let directChildren = [];
          if (level === 7) {
            let inSubGroup = false;
            for (const cr of childRows) {
              if (cr.level === 8 || cr.level === 9) {
                directChildren.push(cr.rowNumber);
                inSubGroup = true;
              } else if (cr.level === 10) {
                if (!inSubGroup) directChildren.push(cr.rowNumber);
              }
            }
          } else {
            let minChildLevel = Infinity;
            for (const cr of childRows) {
              if (cr.level < minChildLevel) minChildLevel = cr.level;
            }
            directChildren = childRows.filter(cr => cr.level === minChildLevel).map(cr => cr.rowNumber);
          }

          if (directChildren.length > 0) {
            const sumExpr = 'SUM(' + directChildren.map(r => 'AP' + r).join(',') + ')';
            worksheet.getRow(curr.rowNumber).getCell(colFA).value = {
              formula: sumExpr
            };
          }
        }
      }
    }
  });

  const matchingReport = {
    totalRkkDetails: totalDetailCount,
    normalDetailsCount: normalDetailCount,
    blockedDetailsCount: blockedItems.length,
    matchedCount: matchedItems.length,
    unmatchedCount: unmatchedItems.length,
    matchPercentage: normalDetailCount > 0 ? ((matchedItems.length / normalDetailCount) * 100).toFixed(1) : '100.0',
    unmatchedItems: unmatchedItems.slice(0, 100),
    blockedItems: blockedItems.slice(0, 150),
    allUnmatchedCount: unmatchedItems.length,
    allBlockedCount: blockedItems.length
  };

  workbook.faMatchingReport = matchingReport;
  return matchingReport;
}

module.exports = faMatching;

