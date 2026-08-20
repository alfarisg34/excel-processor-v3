const ExcelJS = require('exceljs');
const { getCellText } = require('./excel-helpers');
const PATTERNS = require('./patterns');

function isFooterRow(cells) {
  const line = cells.join(' ').trim();
  if (!line) return false;
  if (/\bcatatan\s*:/i.test(line)) return true;
  if (/^\s*\d+\.\s*[\*UP\w]\s*=/i.test(line)) return true;
  if (/\bNIP\s*\d{8}/i.test(line)) return true;
  if (/\bJakarta\b.*,\s*\d+\s+[A-Za-z]+\s+\d{4}/i.test(line)) return true;
  if (/^\s*NURYANTI\s*$/i.test(line)) return true;
  if (/\b\(?KPPN[\.\s\d]/i.test(line) || /\(KPPN[^\)]*\)/i.test(line)) return true;
  if (/^\s*Lokasi\s*:/i.test(line) || (line.startsWith('Lokasi :') && !cells.some(c => c === '-' || c === '>' || c === '>>'))) return true;
  return false;
}

function getLevelNumericOrder(c) {
  if (!c) return 99;
  if (PATTERNS.CODE_322.test(c)) return 1;
  if (PATTERNS.DIGIT_4.test(c)) return 2;
  if (PATTERNS.CODE_43.test(c)) return 3;
  if (PATTERNS.CODE_433.test(c)) return 4;
  if (PATTERNS.DIGIT_3.test(c)) return 5;
  if (PATTERNS.SINGLE_ALPHA.test(c)) return 6;
  if (PATTERNS.DIGIT_6.test(c)) return 7;
  if (c === '>' || c === '>>') return 8;
  if (c === '-') return 10;
  return 99;
}

function extractTagging(cells) {
  let rawColK = (cells[10] || '').trim();
  let rawColL = (cells[11] || '').trim();
  let rawColM = (cells[12] || '').trim();
  let rawColN = (cells[13] || '').trim();
  let rawColO = (cells[14] || '').trim();

  const taggingCandidates = [rawColK, rawColL, rawColM, rawColN, rawColO];
  for (const cand of taggingCandidates) {
    const t = cand.trim().toUpperCase();
    if (t === 'RM' || t === 'PNBP' || t === 'PNP' || t === '*' || t.includes('*')) {
      if (t === 'PNP') return 'PNBP';
      if (t.includes('RM')) return 'RM';
      if (t.includes('PNBP')) return 'PNBP';
      if (t.includes('*')) return '*';
      return t;
    }
  }
  return '';
}

/**
 * Level Validator Module focused on Detail Level (-) with full hierarchy code path tracing and Tagging/Sumber Dana
 * @param {ExcelJS.Workbook|Buffer} inputWorkbookOrBuffer
 * @param {ExcelJS.Workbook} outputWorkbook
 * @returns {Promise<Object>} Validation report object
 */
async function validateLevelDifferences(inputWorkbookOrBuffer, outputWorkbook) {
  let inputWorkbook;
  if (Buffer.isBuffer(inputWorkbookOrBuffer)) {
    inputWorkbook = new ExcelJS.Workbook();
    await inputWorkbook.xlsx.load(inputWorkbookOrBuffer);
  } else {
    inputWorkbook = inputWorkbookOrBuffer;
  }

  const wsInput = inputWorkbook.worksheets[0];
  const wsOutput = outputWorkbook.worksheets[0];

  // 1. Extract Input Detail Rows with Full Hierarchy Breadcrumb & Tagging
  const inputDetails = [];
  const ctx = { program: '', kegiatan: '', kro: '', ro: '', komponen: '', subKomponen: '', akun: '', subGroup: '' };

  wsInput.eachRow({ includeEmpty: false }, (row, rawRowNum) => {
    const cells = [];
    for (let c = 1; c <= 25; c++) cells.push(getCellText(row.getCell(c)));
    if (isFooterRow(cells)) return;

    let colA = (cells[0] || '').trim();
    let colB = (cells[1] || '').trim();
    let colC = (cells[2] || '').trim();
    let colD = (cells[3] || '').trim();
    let colE = (cells[4] || '').trim();
    let colF = (cells[5] || '').trim();

    let rawColH = (cells[7] || '').trim();
    let rawColJ = (cells[9] || '').trim();
    let rawColK = (cells[10] || '').trim();

    let colJ = rawColJ;
    const numJ = parseFloat(rawColJ.replace(/[^0-9.-]/g, ''));
    const numK = parseFloat(rawColK.replace(/[^0-9.-]/g, ''));

    if ((!colJ || isNaN(numJ)) && !isNaN(numK) && numK > 1000) {
      colJ = rawColK;
    }

    let code = colA || colB || colC;
    let rawUraian = '';

    if (code === '-' || colD === '-' || (!code && colE.startsWith('-'))) {
      code = '-';
      rawUraian = colE || colF || colD;
      if (rawUraian.startsWith('-')) rawUraian = rawUraian.replace(/^-\s*/, '');
    } else if (code === '>' || colD === '>' || (!code && colE.startsWith('>'))) {
      code = '>';
      rawUraian = colE || colF || colD;
      if (rawUraian.startsWith('>')) rawUraian = rawUraian.replace(/^>\s*/, '');
    } else if (code === '>>' || colD === '>>' || (!code && colE.startsWith('>>'))) {
      code = '>>';
      rawUraian = colE || colF || colD;
      if (rawUraian.startsWith('>>')) rawUraian = rawUraian.replace(/^>>\s*/, '');
    } else {
      rawUraian = colD || colE || colF;
    }

    if (!code && !rawUraian) return;

    const lvl = getLevelNumericOrder(code);
    if (lvl === 1) { ctx.program = code; ctx.kegiatan = ''; ctx.kro = ''; ctx.ro = ''; ctx.komponen = ''; ctx.subKomponen = ''; ctx.akun = ''; ctx.subGroup = ''; }
    else if (lvl === 2) { ctx.kegiatan = code; ctx.kro = ''; ctx.ro = ''; ctx.komponen = ''; ctx.subKomponen = ''; ctx.akun = ''; ctx.subGroup = ''; }
    else if (lvl === 3) { ctx.kro = code; ctx.ro = ''; ctx.komponen = ''; ctx.subKomponen = ''; ctx.akun = ''; ctx.subGroup = ''; }
    else if (lvl === 4) { ctx.ro = code; ctx.komponen = ''; ctx.subKomponen = ''; ctx.akun = ''; ctx.subGroup = ''; }
    else if (lvl === 5) { ctx.komponen = code; ctx.subKomponen = ''; ctx.akun = ''; ctx.subGroup = ''; }
    else if (lvl === 6) { ctx.subKomponen = code; ctx.akun = ''; ctx.subGroup = ''; }
    else if (lvl === 7) { ctx.akun = code; ctx.subGroup = ''; }
    else if (lvl === 8) { ctx.subGroup = rawUraian; }

    const tagging = extractTagging(cells);
    let valBefore = parseFloat(colJ.replace(/[^0-9.-]/g, ''));
    if (isNaN(valBefore)) valBefore = 0;

    let cleanUraian = rawUraian.replace(/\s*\[.*?(?:\]\s*)?$/, '').replace(/\s+/g, ' ').trim();

    if (code === '-') {
      const codeParts = [ctx.program, ctx.kegiatan, ctx.kro, ctx.ro, ctx.komponen, ctx.subKomponen, ctx.akun].filter(Boolean);
      if (ctx.subGroup) codeParts.push(`> ${ctx.subGroup}`);
      const fullCodePath = codeParts.join(' > ');

      const matchKey = `${ctx.program}|${ctx.kegiatan}|${ctx.kro}|${ctx.ro}|${ctx.komponen}|${ctx.subKomponen}|${ctx.akun}|${ctx.subGroup}|${cleanUraian}|${tagging}`;

      inputDetails.push({ rawRowNum, cleanUraian, tagging, valBefore, fullCodePath, matchKey });
    }
  });

  // 2. Extract Output Detail Rows with Full Hierarchy Breadcrumb & Tagging (Col T / index 20)
  const outputDetails = [];
  const outCtx = { program: '', kegiatan: '', kro: '', ro: '', komponen: '', subKomponen: '', akun: '', subGroup: '' };
  const maxR = wsOutput.rowCount;

  for (let r = 4; r <= maxR; r++) {
    const row = wsOutput.getRow(r);
    const code = getCellText(row.getCell(1)).trim();
    const uraian = getCellText(row.getCell(2)).replace(/\s+/g, ' ').trim();
    const tagging = getCellText(row.getCell(20)).trim(); // Col T (index 20)

    const lvl = getLevelNumericOrder(code);
    if (lvl === 1) { outCtx.program = code; outCtx.kegiatan = ''; outCtx.kro = ''; outCtx.ro = ''; outCtx.komponen = ''; outCtx.subKomponen = ''; outCtx.akun = ''; outCtx.subGroup = ''; }
    else if (lvl === 2) { outCtx.kegiatan = code; outCtx.kro = ''; outCtx.ro = ''; outCtx.komponen = ''; outCtx.subKomponen = ''; outCtx.akun = ''; outCtx.subGroup = ''; }
    else if (lvl === 3) { outCtx.kro = code; outCtx.ro = ''; outCtx.komponen = ''; outCtx.subKomponen = ''; outCtx.akun = ''; outCtx.subGroup = ''; }
    else if (lvl === 4) { outCtx.ro = code; outCtx.komponen = ''; outCtx.subKomponen = ''; outCtx.akun = ''; outCtx.subGroup = ''; }
    else if (lvl === 5) { outCtx.komponen = code; outCtx.subKomponen = ''; outCtx.akun = ''; outCtx.subGroup = ''; }
    else if (lvl === 6) { outCtx.subKomponen = code; outCtx.akun = ''; outCtx.subGroup = ''; }
    else if (lvl === 7) { outCtx.akun = code; outCtx.subGroup = ''; }
    else if (lvl === 8) { outCtx.subGroup = uraian; }

    if (code === '-') {
      const vol1Str = getCellText(row.getCell(5));
      const vol2Str = getCellText(row.getCell(8));
      const vol3Str = getCellText(row.getCell(11));
      const vol4Str = getCellText(row.getCell(14));

      const hasV1 = !!vol1Str;
      const hasV2 = !!vol2Str;
      const hasV3 = !!vol3Str;
      const hasV4 = !!vol4Str;

      const vol1 = parseFloat(vol1Str) || 1;
      const vol2 = parseFloat(vol2Str) || 1;
      const vol3 = parseFloat(vol3Str) || 1;
      const vol4 = parseFloat(vol4Str) || 1;

      let vol = 1;
      if (hasV1) vol *= vol1;
      if (hasV2) vol *= vol2;
      if (hasV3) vol *= vol3;
      if (hasV4) vol *= vol4;

      if (!hasV1 && !hasV2 && !hasV3 && !hasV4) {
        vol = parseFloat(getCellText(row.getCell(16)).replace(/[^0-9.-]/g, '')) || 0;
      }

      const price = parseFloat(getCellText(row.getCell(18)).replace(/[^0-9.-]/g, '')) || 0;
      let valAfter = vol * price;
      if (valAfter === 0) {
        let rawS = getCellText(row.getCell(19));
        valAfter = parseFloat(rawS.replace(/[^0-9.-]/g, '')) || 0;
      }

      const codeParts = [outCtx.program, outCtx.kegiatan, outCtx.kro, outCtx.ro, outCtx.komponen, outCtx.subKomponen, outCtx.akun].filter(Boolean);
      if (outCtx.subGroup) codeParts.push(`> ${outCtx.subGroup}`);
      const fullCodePath = codeParts.join(' > ');

      const matchKey = `${outCtx.program}|${outCtx.kegiatan}|${outCtx.kro}|${outCtx.ro}|${outCtx.komponen}|${outCtx.subKomponen}|${outCtx.akun}|${outCtx.subGroup}|${uraian}|${tagging}`;

      outputDetails.push({ outRowNum: r, uraian, tagging, vol, price, valAfter, fullCodePath, matchKey });
    }
  }

  // 3. Match Details & Calculate Differences
  const allDetailItems = [];

  outputDetails.forEach((outD, idx) => {
    // 1-to-1 sequential match is primary (restructure preserves row sequence 1-to-1)
    const inSeq = inputDetails[idx];
    const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

    let inD = inSeq;
    if (!inD || norm(inD.cleanUraian) !== norm(outD.uraian)) {
      inD = inputDetails.find((i) => i.matchKey === outD.matchKey) ||
            inputDetails.find((i) => norm(i.cleanUraian) === norm(outD.uraian));
    }

    const valBefore = inD ? inD.valBefore : 0;
    const valAfter = outD.valAfter;
    const diff = Math.round(valAfter - valBefore);

    allDetailItems.push({
      itemNumber: idx + 1,
      outRowNum: outD.outRowNum,
      rawRowNum: inD ? inD.rawRowNum : '-',
      fullCodePath: outD.fullCodePath,
      uraian: outD.uraian,
      tagging: outD.tagging || (inD ? inD.tagging : '') || '-',
      valBefore,
      valAfter,
      diff,
      status: Math.abs(diff) === 0 ? 'MATCH' : 'DIFF',
    });
  });

  // Aggregated Stats
  let totalBefore = 0;
  let totalAfter = 0;
  let matchCount = 0;
  let diffCount = 0;

  allDetailItems.forEach((item) => {
    totalBefore += item.valBefore;
    totalAfter += item.valAfter;
    if (item.status === 'MATCH') matchCount++;
    else diffCount++;
  });

  const totalDiff = Math.round(totalAfter - totalBefore);

  // 4. Calculate Code 322 (Program Level) Comparison using recursive formula evaluation
  function evaluateRowS(rowNum) {
    const row = wsOutput.getRow(rowNum);
    const code = getCellText(row.getCell(1)).trim();

    if (code === '-') {
      const vol1Str = getCellText(row.getCell(5));
      const vol2Str = getCellText(row.getCell(8));
      const vol3Str = getCellText(row.getCell(11));
      const vol4Str = getCellText(row.getCell(14));

      const vol1 = parseFloat(vol1Str) || 1;
      const vol2 = parseFloat(vol2Str) || 1;
      const vol3 = parseFloat(vol3Str) || 1;
      const vol4 = parseFloat(vol4Str) || 1;

      let vol = 1;
      if (vol1Str) vol *= vol1;
      if (vol2Str) vol *= vol2;
      if (vol3Str) vol *= vol3;
      if (vol4Str) vol *= vol4;

      if (!vol1Str && !vol2Str && !vol3Str && !vol4Str) {
        vol = parseFloat(getCellText(row.getCell(16)).replace(/[^0-9.-]/g, '')) || 0;
      }

      const price = parseFloat(getCellText(row.getCell(18)).replace(/[^0-9.-]/g, '')) || 0;
      let val = vol * price;
      if (val === 0) {
        let rawS = getCellText(row.getCell(19));
        val = parseFloat(rawS.replace(/[^0-9.-]/g, '')) || 0;
      }
      return val;
    }

    const cellS = row.getCell(19);
    const valObj = cellS.value;
    if (valObj && valObj.formula) {
      const refs = valObj.formula.replace(/^SUM\(/, '').replace(/\)$/, '').split(',');
      let sum = 0;
      refs.forEach((ref) => {
        const rN = parseInt(ref.replace(/[^0-9]/g, ''));
        if (rN) sum += evaluateRowS(rN);
      });
      return sum;
    }
    return parseFloat(getCellText(cellS).replace(/[^0-9.-]/g, '')) || 0;
  }

  const programSummary = [];
  const inputPrograms = [];

  wsInput.eachRow({ includeEmpty: false }, (row, rawRowNum) => {
    const cells = [];
    for (let c = 1; c <= 25; c++) cells.push(getCellText(row.getCell(c)));
    if (isFooterRow(cells)) return;

    let colA = (cells[0] || '').trim();
    let colB = (cells[1] || '').trim();
    let colD = (cells[3] || '').trim();
    let colE = (cells[4] || '').trim();
    let rawColJ = (cells[9] || '').trim();
    let rawColK = (cells[10] || '').trim();

    let colJ = rawColJ;
    const numJ = parseFloat(rawColJ.replace(/[^0-9.-]/g, ''));
    const numK = parseFloat(rawColK.replace(/[^0-9.-]/g, ''));
    if ((!colJ || isNaN(numJ)) && !isNaN(numK) && numK > 1000) colJ = rawColK;

    const code = colA || colB;
    if (PATTERNS.CODE_322.test(code)) {
      const valBefore = parseFloat(colJ.replace(/[^0-9.-]/g, '')) || 0;
      const uraian = (colD || colE || '').replace(/\s+/g, ' ').trim();
      inputPrograms.push({ rawRowNum, code, uraian, valBefore });
    }
  });

  for (let r = 4; r <= maxR; r++) {
    const row = wsOutput.getRow(r);
    const code = getCellText(row.getCell(1)).trim();
    const uraian = getCellText(row.getCell(2)).replace(/\s+/g, ' ').trim();

    if (PATTERNS.CODE_322.test(code)) {
      const sumAfter = evaluateRowS(r);

      const inP = inputPrograms.find((i) => i.code === code);
      const valBefore = inP ? inP.valBefore : 0;
      const diff = Math.round(sumAfter - valBefore);

      programSummary.push({
        outRowNum: r,
        code,
        uraian,
        before: valBefore,
        after: sumAfter,
        diff,
        status: Math.abs(diff) === 0 ? 'MATCH' : 'DIFF',
      });
    }
  }

  // Filter discrepancies (items with selisih)
  const discrepancyItems = allDetailItems.filter((i) => i.status === 'DIFF');
  discrepancyItems.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // Limit header payload to top 25 items to prevent HTTP header size overflow
  const headerDiscrepancyItems = discrepancyItems.slice(0, 25);

  return {
    totalItemsCount: allDetailItems.length,
    matchCount,
    diffCount,
    totalBefore,
    totalAfter,
    totalDiff,
    overallStatus: Math.abs(totalDiff) === 0 ? 'MATCH' : 'DIFF',
    programSummary,
    discrepancyItems: headerDiscrepancyItems,
    sampleAllItems: allDetailItems.slice(0, 30), // Lightweight preview of first 30 items
  };
}

module.exports = validateLevelDifferences;
