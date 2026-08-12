const ExcelJS = require('exceljs');
const { getCellText } = require('./excel-helpers');
const PATTERNS = require('./patterns');

/**
 * Returns numeric hierarchy level order
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

function isFooterRow(cells) {
  const line = cells.join(' ').trim();
  if (!line) return false;
  if (/\bcatatan\s*:/i.test(line)) return true;
  if (/^\s*\d+\.\s*[\*UP\w]\s*=/i.test(line)) return true;
  if (/\bNIP\s*\d{8}/i.test(line)) return true;
  if (/\bJakarta\b.*,\s*\d+\s+[A-Za-z]+\s+\d{4}/i.test(line)) return true;
  if (/^\s*NURYANTI\s*$/i.test(line)) return true;
  return false;
}

function extractTagging(cells) {
  for (let c = 9; c <= 15; c++) {
    const t = (cells[c] || '').trim().toUpperCase();
    if (t === 'RM' || t === 'PNP' || t === 'PNBP') {
      return t === 'PNP' ? 'PNBP' : t;
    }
  }
  return '';
}

/**
 * Main parser function to extract hierarchical recap from RINCIAN KERTAS KERJA SATKER buffer
 * @param {Buffer} buffer - File buffer of RKK Satker
 * @returns {Promise<Object>} Hierarchical recap payload
 */
async function parseHierarchyRecap(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const ws = workbook.worksheets[0];

  const ctx = {
    c322: '', c322Name: '',
    d4: '', d4Name: '',
    c43: '', c43Name: '',
    c433: '', c433Name: '',
    d3: '', d3Name: '',
    alpha: '', alphaName: '',
    d6: '', d6Name: '', d6Tagging: '', d6BlockCode: ''
  };

  const nodeMap = new Map(); // key -> { key, code, name, level, levelName, parentKey, fullPath, records: [] }

  function getOrCreateNode(key, code, name, level, levelName, parentKey, fullPath) {
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        key,
        code,
        name,
        level,
        levelName,
        parentKey,
        fullPath,
        records: []
      });
    }
    const node = nodeMap.get(key);
    if (name && !node.name) node.name = name;
    return node;
  }

  // Always create Root Node
  getOrCreateNode('ROOT', 'SATKER', 'Seluruh Satker (Total All Level)', 0, 'Total Satker', '', 'SATKER');

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const cells = [];
    for (let c = 1; c <= 20; c++) cells.push(getCellText(row.getCell(c)));
    if (isFooterRow(cells)) return;

    let colA = (cells[0] || '').trim();
    let colB = (cells[1] || '').trim();
    let colC = (cells[2] || '').trim();
    let colD = (cells[3] || '').trim();
    let colE = (cells[4] || '').trim();
    let colF = (cells[5] || '').trim();

    let code = colA || colB || colC;
    let uraian = colD || colE || colF;

    if (code === '-' || colD === '-' || (!code && colE.startsWith('-'))) {
      code = '-';
      uraian = colE || colF || colD;
      if (uraian.startsWith('-')) uraian = uraian.replace(/^-\s*/, '');
    } else if (code === '>' || colD === '>' || (!code && colE.startsWith('>'))) {
      code = '>';
      uraian = colE || colF || colD;
      if (uraian.startsWith('>')) uraian = uraian.replace(/^>\s*/, '');
    } else if (code === '>>' || colD === '>>' || (!code && colE.startsWith('>>'))) {
      code = '>>';
      uraian = colE || colF || colD;
      if (uraian.startsWith('>>')) uraian = uraian.replace(/^>>\s*/, '');
    }

    if (!code && !uraian) return;

    let rawColJ = (cells[9] || '').trim();
    let rawColK = (cells[10] || '').trim();

    let colJ = rawColJ;
    let colK = rawColK;

    const numJ = parseFloat(rawColJ.replace(/[^0-9.-]/g, ''));
    const numK = parseFloat(rawColK.replace(/[^0-9.-]/g, ''));

    const isShiftedJumlah = (!colJ || isNaN(numJ)) && !isNaN(numK) && numK > 1000;

    if (isShiftedJumlah) {
      colJ = rawColK; // Amount shifted to Col K
      colK = '';      // Col K is monetary amount, NOT block code
    }

    const lvl = getCodeLevel(code);

    if (lvl === 1) {
      if (ctx.c322 === code && ctx.c322Name && uraian) {
        ctx.c322Name += ' ' + uraian;
      } else {
        ctx.c322 = code; ctx.c322Name = uraian;
        ctx.d4 = ''; ctx.d4Name = '';
        ctx.c43 = ''; ctx.c43Name = '';
        ctx.c433 = ''; ctx.c433Name = '';
        ctx.d3 = ''; ctx.d3Name = '';
        ctx.alpha = ''; ctx.alphaName = '';
        ctx.d6 = ''; ctx.d6Name = ''; ctx.d6Tagging = ''; ctx.d6BlockCode = '';
        getOrCreateNode(`L1_${code}`, code, uraian, 1, 'Code 322 (Program)', 'ROOT', code);
      }
    } else if (lvl === 2) {
      if (ctx.d4 === code && ctx.d4Name && uraian) {
        ctx.d4Name += ' ' + uraian;
      } else {
        ctx.d4 = code; ctx.d4Name = uraian;
        ctx.c43 = ''; ctx.c43Name = '';
        ctx.c433 = ''; ctx.c433Name = '';
        ctx.d3 = ''; ctx.d3Name = '';
        ctx.alpha = ''; ctx.alphaName = '';
        ctx.d6 = ''; ctx.d6Name = ''; ctx.d6Tagging = ''; ctx.d6BlockCode = '';
        const pKey = ctx.c322 ? `L1_${ctx.c322}` : 'ROOT';
        const path = [ctx.c322, code].filter(Boolean).join(' > ');
        getOrCreateNode(`L2_${ctx.c322}_${code}`, code, uraian, 2, 'Digit 4 (Kegiatan)', pKey, path);
      }
    } else if (lvl === 3) {
      if (ctx.c43 === code && ctx.c43Name && uraian) {
        ctx.c43Name += ' ' + uraian;
      } else {
        ctx.c43 = code; ctx.c43Name = uraian;
        ctx.c433 = ''; ctx.c433Name = '';
        ctx.d3 = ''; ctx.d3Name = '';
        ctx.alpha = ''; ctx.alphaName = '';
        ctx.d6 = ''; ctx.d6Name = ''; ctx.d6Tagging = ''; ctx.d6BlockCode = '';
        const pKey = ctx.d4 ? `L2_${ctx.c322}_${ctx.d4}` : (ctx.c322 ? `L1_${ctx.c322}` : 'ROOT');
        const path = [ctx.c322, ctx.d4, code].filter(Boolean).join(' > ');
        getOrCreateNode(`L3_${ctx.c322}_${ctx.d4}_${code}`, code, uraian, 3, 'Code 43 (KRO)', pKey, path);
      }
    } else if (lvl === 4) {
      if (ctx.c433 === code && ctx.c433Name && uraian) {
        ctx.c433Name += ' ' + uraian;
      } else {
        ctx.c433 = code; ctx.c433Name = uraian;
        ctx.d3 = ''; ctx.d3Name = '';
        ctx.alpha = ''; ctx.alphaName = '';
        ctx.d6 = ''; ctx.d6Name = ''; ctx.d6Tagging = ''; ctx.d6BlockCode = '';
        const pKey = ctx.c43 ? `L3_${ctx.c322}_${ctx.d4}_${ctx.c43}` : (ctx.d4 ? `L2_${ctx.c322}_${ctx.d4}` : 'ROOT');
        const path = [ctx.c322, ctx.d4, ctx.c43, code].filter(Boolean).join(' > ');
        getOrCreateNode(`L4_${ctx.c322}_${ctx.d4}_${ctx.c43}_${code}`, code, uraian, 4, 'Code 433 (RO)', pKey, path);
      }
    } else if (lvl === 5) {
      if (ctx.d3 === code && ctx.d3Name && uraian) {
        ctx.d3Name += ' ' + uraian;
      } else {
        ctx.d3 = code; ctx.d3Name = uraian;
        ctx.alpha = ''; ctx.alphaName = '';
        ctx.d6 = ''; ctx.d6Name = ''; ctx.d6Tagging = ''; ctx.d6BlockCode = '';
        const pKey = ctx.c433 ? `L4_${ctx.c322}_${ctx.d4}_${ctx.c43}_${ctx.c433}` : 'ROOT';
        const path = [ctx.c322, ctx.d4, ctx.c43, ctx.c433, code].filter(Boolean).join(' > ');
        getOrCreateNode(`L5_${ctx.c322}_${ctx.d4}_${ctx.c43}_${ctx.c433}_${code}`, code, uraian, 5, 'Digit 3 (Komponen)', pKey, path);
      }
    } else if (lvl === 6) {
      if (ctx.alpha === code && ctx.alphaName && uraian) {
        ctx.alphaName += ' ' + uraian;
      } else {
        ctx.alpha = code; ctx.alphaName = uraian;
        ctx.d6 = ''; ctx.d6Name = ''; ctx.d6Tagging = ''; ctx.d6BlockCode = '';
        const pKey = ctx.d3 ? `L5_${ctx.c322}_${ctx.d4}_${ctx.c43}_${ctx.c433}_${ctx.d3}` : 'ROOT';
        const path = [ctx.c322, ctx.d4, ctx.c43, ctx.c433, ctx.d3, code].filter(Boolean).join(' > ');
        getOrCreateNode(`L6_${ctx.c322}_${ctx.d4}_${ctx.c43}_${ctx.c433}_${ctx.d3}_${code}`, code, uraian, 6, 'Single Alpha (Subkomponen)', pKey, path);
      }
    } else if (lvl === 7) {
      if (ctx.d6 === code && ctx.d6Name && uraian) {
        ctx.d6Name += ' ' + uraian;
      } else {
        ctx.d6 = code; ctx.d6Name = uraian;
        ctx.d6Tagging = extractTagging(cells) || 'RM';

        let blockCandidate = colK;
        const numCand = parseFloat(blockCandidate.replace(/[^0-9.-]/g, ''));
        if (blockCandidate && !isNaN(numCand) && numCand > 99) {
          blockCandidate = '';
        }
        ctx.d6BlockCode = blockCandidate;
      }
    }

    if (code === '-') {
      // Determine value from colJ (normalized), fallback to cells[9] / cells[10] / cells[7]
      let valStr = colJ || cells[9] || cells[10] || cells[7] || '0';
      let val = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;

      // Check if blocked: star in column 10 (11th cell) or any cell has '*' or uraian contains 'blokir'
      const isBlocked = cells.some((cell) => cell === '*' || cell.includes('*')) || uraian.toLowerCase().includes('blokir');
      const tagging = ctx.d6Tagging || 'RM';

      const rec = {
        rowNum,
        c322: ctx.c322, c322Name: ctx.c322Name,
        d4: ctx.d4, d4Name: ctx.d4Name,
        c43: ctx.c43, c43Name: ctx.c43Name,
        c433: ctx.c433, c433Name: ctx.c433Name,
        d3: ctx.d3, d3Name: ctx.d3Name,
        alpha: ctx.alpha, alphaName: ctx.alphaName,
        d6: ctx.d6, d6Name: ctx.d6Name,
        tagging,
        blockCode: ctx.d6BlockCode || '',
        uraian,
        val,
        isBlocked
      };

      // Add record to all active hierarchy parent nodes
      const activeKeys = [
        'ROOT',
        ctx.c322 ? `L1_${ctx.c322}` : null,
        ctx.c322 && ctx.d4 ? `L2_${ctx.c322}_${ctx.d4}` : null,
        ctx.c322 && ctx.d4 && ctx.c43 ? `L3_${ctx.c322}_${ctx.d4}_${ctx.c43}` : null,
        ctx.c322 && ctx.d4 && ctx.c43 && ctx.c433 ? `L4_${ctx.c322}_${ctx.d4}_${ctx.c43}_${ctx.c433}` : null,
        ctx.c322 && ctx.d4 && ctx.c43 && ctx.c433 && ctx.d3 ? `L5_${ctx.c322}_${ctx.d4}_${ctx.c43}_${ctx.c433}_${ctx.d3}` : null,
        ctx.c322 && ctx.d4 && ctx.c43 && ctx.c433 && ctx.d3 && ctx.alpha ? `L6_${ctx.c322}_${ctx.d4}_${ctx.c43}_${ctx.c433}_${ctx.d3}_${ctx.alpha}` : null,
      ].filter(Boolean);

      activeKeys.forEach((key) => {
        if (nodeMap.has(key)) {
          nodeMap.get(key).records.push(rec);
        }
      });
    }
  });

  // Calculate summaries for each node
  const nodeSummaries = {};

  for (const [key, node] of nodeMap.entries()) {
    let totalVal = 0;
    let totalRM = 0;
    let totalPNBP = 0;
    let blockedRM = 0;
    let blockedPNBP = 0;
    let totalBlocked = 0;
    const blockedByCodeMap = new Map();

    const d6Map = new Map();

    node.records.forEach((r) => {
      totalVal += r.val;
      if (r.tagging === 'RM') totalRM += r.val;
      else totalPNBP += r.val;

      if (r.isBlocked) {
        totalBlocked += r.val;
        if (r.tagging === 'RM') blockedRM += r.val;
        else blockedPNBP += r.val;

        const codeKey = r.blockCode || 'Tanpa Kode';
        blockedByCodeMap.set(codeKey, (blockedByCodeMap.get(codeKey) || 0) + r.val);
      }

      // Group Digit 6 under node by code & tagging
      const d6Code = r.d6 || 'Lainnya';
      const d6Tagging = r.tagging || 'RM';
      const d6Key = `${d6Code}_${d6Tagging}`;

      if (!d6Map.has(d6Key)) {
        d6Map.set(d6Key, {
          code: d6Code,
          name: r.d6Name || 'Detail Akun',
          tagging: d6Tagging,
          blockCode: r.blockCode || '',
          totalVal: 0,
          totalRM: 0,
          totalPNBP: 0,
          blockedRM: 0,
          blockedPNBP: 0,
          totalBlocked: 0,
          details: []
        });
      }

      const d6Summary = d6Map.get(d6Key);
      if (r.blockCode && !d6Summary.blockCode) {
        d6Summary.blockCode = r.blockCode;
      }
      d6Summary.totalVal += r.val;
      if (r.tagging === 'RM') d6Summary.totalRM += r.val;
      else d6Summary.totalPNBP += r.val;

      if (r.isBlocked) {
        d6Summary.totalBlocked += r.val;
        if (r.tagging === 'RM') d6Summary.blockedRM += r.val;
        else d6Summary.blockedPNBP += r.val;
      }

      d6Summary.details.push({
        rowNum: r.rowNum,
        uraian: r.uraian,
        val: r.val,
        tagging: r.tagging,
        blockCode: r.blockCode || '',
        isBlocked: r.isBlocked
      });
    });

    const digit6List = Array.from(d6Map.values()).map((d6) => {
      return {
        ...d6,
        blockedPct: d6.totalVal > 0 ? ((d6.totalBlocked / d6.totalVal) * 100).toFixed(1) : '0.0'
      };
    });

    // Sort Digit 6 list: code ascending, then RM before PNP
    digit6List.sort((a, b) => {
      const codeCmp = a.code.localeCompare(b.code, undefined, { numeric: true });
      if (codeCmp !== 0) return codeCmp;
      const tagPriority = { 'RM': 1, 'PNP': 2, 'PNBP': 2 };
      const pA = tagPriority[a.tagging] || 9;
      const pB = tagPriority[b.tagging] || 9;
      return pA - pB;
    });

    const blockedByCode = {};
    const blockedByCodeList = [];
    for (const [bCode, bVal] of blockedByCodeMap.entries()) {
      blockedByCode[bCode] = bVal;
      blockedByCodeList.push({ code: bCode, val: bVal });
    }
    blockedByCodeList.sort((a, b) => a.code.localeCompare(b.code));

    nodeSummaries[key] = {
      key: node.key,
      code: node.code,
      name: node.name,
      level: node.level,
      levelName: node.levelName,
      parentKey: node.parentKey,
      fullPath: node.fullPath,
      totalVal,
      totalRM,
      totalPNBP,
      blockedRM,
      blockedPNBP,
      totalBlocked,
      blockedPct: totalVal > 0 ? ((totalBlocked / totalVal) * 100).toFixed(1) : '0.0',
      blockedByCode,
      blockedByCodeList,
      recordCount: node.records.length,
      digit6List
    };
  }

  const levelOptions = [
    { level: 0, label: 'Seluruh Satker (Semua Program)' },
    { level: 1, label: 'Code 322 (Program)' },
    { level: 2, label: 'Digit 4 (Kegiatan)' },
    { level: 3, label: 'Code 43 (KRO)' },
    { level: 4, label: 'Code 433 (RO)' },
    { level: 5, label: 'Digit 3 (Komponen)' },
    { level: 6, label: 'Single Alpha (Subkomponen)' }
  ];

  const nodesByLevel = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  for (const nodeKey in nodeSummaries) {
    const n = nodeSummaries[nodeKey];
    if (nodesByLevel[n.level]) {
      nodesByLevel[n.level].push({
        key: n.key,
        code: n.code,
        name: n.name,
        fullPath: n.fullPath,
        totalVal: n.totalVal
      });
    }
  }

  // Sort nodes in each level by code
  for (const lvl in nodesByLevel) {
    nodesByLevel[lvl].sort((a, b) => a.code.localeCompare(b.code));
  }

  return {
    rootSummary: nodeSummaries['ROOT'],
    nodeSummaries,
    levelOptions,
    nodesByLevel
  };
}

module.exports = parseHierarchyRecap;
