const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { getCellText } = require('../utils/excel-helpers');
const PATTERNS = require('../utils/patterns');

/**
 * Format Date to DDMMYY (e.g. 230926)
 */
function getProcessDateDDMMYY(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

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
 * Helper to calculate nominal Pagu from a detail row (-)
 */
function getDetailRowPagu(row) {
  const cell19 = row.getCell(19).value;
  if (typeof cell19 === 'number') return cell19;
  if (cell19 && typeof cell19.result === 'number') return cell19.result;

  const cell39 = row.getCell(39).value;
  if (typeof cell39 === 'number') return cell39;
  if (cell39 && typeof cell39.result === 'number') return cell39.result;

  const hargasat = parseFloat(getCellText(row.getCell(18)).replace(/[^0-9.-]/g, '')) || 
                   parseFloat(getCellText(row.getCell(38)).replace(/[^0-9.-]/g, '')) || 0;
  
  const e = parseFloat(getCellText(row.getCell(5)));
  const h = parseFloat(getCellText(row.getCell(8)));
  const k = parseFloat(getCellText(row.getCell(11)));
  const n = parseFloat(getCellText(row.getCell(14)));

  let vol = 1;
  let hasMultiplier = false;
  if (!isNaN(e)) { vol *= e; hasMultiplier = true; }
  if (!isNaN(h)) { vol *= h; hasMultiplier = true; }
  if (!isNaN(k)) { vol *= k; hasMultiplier = true; }
  if (!isNaN(n)) { vol *= n; hasMultiplier = true; }

  if (!hasMultiplier) {
    const p = parseFloat(getCellText(row.getCell(16)).replace(/[^0-9.-]/g, ''));
    if (!isNaN(p)) vol = p;
  }

  return Math.round(vol * hargasat);
}

/**
 * Helper to parse Laporan FA Detail (16 Segmen) with full multi-criteria hierarchy context
 * @param {Buffer} faBuffer
 * @returns {Promise<Array<{rawRowNum: number, program: string, kegiatan: string, kro: string, ro: string, fullRo: string, komponen: string, subkomponen: string, akun: string, uraian: string, pagu: number, realisasi: number, sisa: number}>>}
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

    // Read Pagu strictly from Column 17 (Pagu Revisi)
    const paguRaw = row.getCell(17).value;
    let paguNum = 0;
    if (typeof paguRaw === 'number') {
      paguNum = paguRaw;
    } else if (paguRaw !== null && paguRaw !== undefined) {
      const resVal = (typeof paguRaw === 'object' && paguRaw.result !== undefined) ? paguRaw.result : paguRaw;
      const parsed = parseFloat(String(resVal).replace(/[^0-9.-]/g, ''));
      paguNum = isNaN(parsed) ? 0 : parsed;
    }

    // Read Realisasi s.d. Periode strictly from Column 26
    const realRaw = row.getCell(26).value;
    let realNum = 0;
    if (typeof realRaw === 'number') {
      realNum = realRaw;
    } else if (realRaw !== null && realRaw !== undefined) {
      const resVal = (typeof realRaw === 'object' && realRaw.result !== undefined) ? realRaw.result : realRaw;
      const parsed = parseFloat(String(resVal).replace(/[^0-9.-]/g, ''));
      realNum = isNaN(parsed) ? 0 : parsed;
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
        realisasi: realNum,
        sisa: sisaNum
      });
    }
  }

  return items;
}

/**
 * Step 6: Match Laporan FA to worksheet detail rows, inserting Realisasi s/d {DDMMYY} in Col AP (42)
 * and Sisa Anggaran in Col AQ (43) with multi-criteria hierarchy + Pagu matching and hierarchical SUM.
 * @param {ExcelJS.Workbook} workbook
 * @param {Buffer} [faBuffer] - Optional Laporan FA file buffer
 * @param {Object} [options]
 * @returns {Promise<Object|null>} Matching summary report
 */
async function faMatching(workbook, faBuffer, options = {}) {
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

  const processDate = options.processDate || new Date();
  const dateStr = getProcessDateDDMMYY(processDate);
  const realisasiHeader = `REALISASI\ns/d\n${dateStr}`;
  const sisaHeader = 'SISA\nANGGARAN';

  workbook.worksheets.forEach((worksheet) => {
    // Target Columns: AP (42) for Realisasi, AQ (43) for Sisa Anggaran
    const colReal = 42;
    const colSisa = 43;

    // Set headers at row 1 (master cells of merged ranges AP1:AP3 and AQ1:AQ3)
    worksheet.getRow(1).getCell(colReal).value = realisasiHeader;
    worksheet.getRow(1).getCell(colSisa).value = sisaHeader;

    const rkkCtx = { program: '', kegiatan: '', kro: '', ro: '', komponen: '', subkomponen: '', akun: '' };
    const maxR = worksheet.rowCount;
    const detailRows = [];

    // 1. Scan and collect detail rows with their full hierarchy context & Pagu
    for (let r = 4; r <= maxR; r++) {
      const row = worksheet.getRow(r);
      const code = getCellText(row.getCell(1)).trim();
      const uraian = getCellText(row.getCell(2)).trim();
      const valT = getCellText(row.getCell(20)).trim();
      const valAN = getCellText(row.getCell(40)).trim();
      const cleanUraian = uraian.replace(/\s*\[.*?(?:\]\s*)?$/, '').replace(/\s+/g, ' ').trim();
      const pagu = getDetailRowPagu(row);

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
        rkkCtx.akunTagging = valT || valAN || '';
      } else if (code === '-') {
        totalDetailCount++;

        // Rule: If Tagging RM/PNBP has '*', or PLN has 'RK', this is a blocked budget and will NOT exist in FA Detail
        const isBlockedStar = valT.includes('*') || valAN.includes('*');
        const isBlockedRK = valT === 'RK' || valAN === 'RK' || valT.includes('RK') || valAN.includes('RK');
        const isBlockedText = cleanUraian.toLowerCase().includes('blokir');
        const isBlocked = isBlockedStar || isBlockedRK || isBlockedText;

        if (isBlocked) {
          row.getCell(colReal).value = 0;
          row.getCell(colSisa).value = 0;
          const isRK = isBlockedRK || (rkkCtx.akunTagging === 'PLN' && !isBlockedStar);
          blockedItems.push({
            rowNumber: r,
            hierarchyPath: [rkkCtx.program, rkkCtx.kegiatan, rkkCtx.kro, rkkCtx.ro, rkkCtx.komponen, rkkCtx.subkomponen, rkkCtx.akun].filter(Boolean).join(' > '),
            uraian: cleanUraian,
            pagu: pagu,
            tagging: valT || valAN || (isRK ? 'RK' : '*'),
            status: isRK ? 'Anggaran Diblokir (Tagging RK)' : 'Anggaran Diblokir (Tagging *)'
          });
          continue;
        }

        normalDetailCount++;
        detailRows.push({
          rowNum: r,
          ctx: { ...rkkCtx },
          cleanUraian,
          pagu,
          tagging: valT || valAN || '-',
          matchedIdx: -1
        });
      }
    }

    // 2. Two-Pass Matching Strategy:
    // Pass 1: Strict Hierarchy + Uraian + Pagu (prevents unordered items under the same Akun from swapping!)
    for (const d of detailRows) {
      for (let i = 0; i < faData.length; i++) {
        if (faUsed.has(i)) continue;
        const fa = faData[i];
        const matchAkun = !d.ctx.akun || !fa.akun || d.ctx.akun === fa.akun;
        const matchKomp = !d.ctx.komponen || !fa.komponen || d.ctx.komponen === fa.komponen;
        const matchSub = !d.ctx.subkomponen || !fa.subkomponen || d.ctx.subkomponen.toUpperCase() === fa.subkomponen.toUpperCase();
        const matchRo = !d.ctx.ro || !fa.ro || d.ctx.ro === fa.ro || d.ctx.ro.endsWith(fa.ro) || fa.ro.endsWith(d.ctx.ro);
        const matchName = d.cleanUraian.toLowerCase() === fa.uraian.toLowerCase();
        const matchPagu = Math.abs(d.pagu - fa.pagu) <= 1 || (d.pagu > 0 && Math.abs(d.pagu - fa.pagu) / d.pagu < 0.001);

        if (matchAkun && matchKomp && matchSub && matchRo && matchName && matchPagu) {
          d.matchedIdx = i;
          faUsed.add(i);
          break;
        }
      }
    }

    // Pass 2: Fallback without Pagu for any remaining unmatched detail items
    for (const d of detailRows) {
      if (d.matchedIdx !== -1) continue;
      for (let i = 0; i < faData.length; i++) {
        if (faUsed.has(i)) continue;
        const fa = faData[i];
        const matchAkun = !d.ctx.akun || !fa.akun || d.ctx.akun === fa.akun;
        const matchKomp = !d.ctx.komponen || !fa.komponen || d.ctx.komponen === fa.komponen;
        const matchSub = !d.ctx.subkomponen || !fa.subkomponen || d.ctx.subkomponen.toUpperCase() === fa.subkomponen.toUpperCase();
        const matchRo = !d.ctx.ro || !fa.ro || d.ctx.ro === fa.ro || d.ctx.ro.endsWith(fa.ro) || fa.ro.endsWith(d.ctx.ro);
        const matchName = d.cleanUraian.toLowerCase() === fa.uraian.toLowerCase();

        if (matchAkun && matchKomp && matchSub && matchRo && matchName) {
          d.matchedIdx = i;
          faUsed.add(i);
          break;
        }
      }
    }

    // Populate detail row cells (Col AP for Realisasi, Col AQ for Sisa Anggaran)
    for (const d of detailRows) {
      const row = worksheet.getRow(d.rowNum);
      if (d.matchedIdx !== -1) {
        const matchedFA = faData[d.matchedIdx];
        row.getCell(colReal).value = matchedFA.realisasi;
        row.getCell(colSisa).value = matchedFA.sisa;
        matchedItems.push({
          rowNumber: d.rowNum,
          hierarchyPath: [d.ctx.program, d.ctx.kegiatan, d.ctx.kro, d.ctx.ro, d.ctx.komponen, d.ctx.subkomponen, d.ctx.akun].filter(Boolean).join(' > '),
          uraian: d.cleanUraian,
          pagu: d.pagu,
          realisasi: matchedFA.realisasi,
          sisa: matchedFA.sisa
        });
      } else {
        row.getCell(colReal).value = 0;
        row.getCell(colSisa).value = 0;
        unmatchedItems.push({
          rowNumber: d.rowNum,
          hierarchyPath: [d.ctx.program, d.ctx.kegiatan, d.ctx.kro, d.ctx.ro, d.ctx.komponen, d.ctx.subkomponen, d.ctx.akun].filter(Boolean).join(' > '),
          uraian: d.cleanUraian,
          pagu: d.pagu,
          tagging: d.tagging,
          status: 'Tidak Ditemukan di FA'
        });
      }
    }

    // 3. Pass 2: Bottom-up hierarchical SUM in Column AP (42) and AQ (43) for all header codes (level 9 to 1)
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
            const sumExprReal = 'SUM(' + directChildren.map(r => 'AP' + r).join(',') + ')';
            const sumExprSisa = 'SUM(' + directChildren.map(r => 'AQ' + r).join(',') + ')';
            worksheet.getRow(curr.rowNumber).getCell(colReal).value = { formula: sumExprReal };
            worksheet.getRow(curr.rowNumber).getCell(colSisa).value = { formula: sumExprSisa };
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

