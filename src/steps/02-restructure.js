const { getCellText } = require('../utils/excel-helpers');
const PATTERNS = require('../utils/patterns');

/**
 * Helper to check if a row is a non-table footer/notes/signature row
 */
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

/**
 * Extract signature metadata from raw worksheet before cleanup
 */
function extractSignatureInfo(worksheet) {
  let dateLine = '';
  let nameLine = '';
  let nipLine = '';

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      const txt = getCellText(cell);
      if (!txt) return;
      if (/\bJakarta\b.*,\s*\d+\s+[A-Za-z]+\s+\d{4}/i.test(txt)) {
        dateLine = txt;
      } else if (/\bNIP\s*\d+/i.test(txt)) {
        nipLine = txt;
      } else if (
        /^[A-Z\s]{4,}$/.test(txt) &&
        !txt.includes('KETERANGAN') &&
        !txt.includes('SATKER') &&
        !txt.includes('SATUAN') &&
        !txt.includes('BELANJA') &&
        !txt.includes('KOMPONEN') &&
        !txt.includes('JAKARTA')
      ) {
        nameLine = txt;
      }
    });
  });

  return { dateLine, nameLine, nipLine };
}

/**
 * Helper to parse bracket multipliers like "[24 org x 10 kl]" or "[5 org x 6 jpl x 1 kl]"
 */
function parseMultipliers(text) {
  if (!text || typeof text !== 'string') return { cleanUraian: text || '', terms: [] };

  const match = text.match(/^(.*?)\s*\[(.*?)(?:\]\s*)?$/);
  if (!match) {
    return { cleanUraian: text.trim(), terms: [] };
  }

  const cleanUraian = match[1].replace(/\s+/g, ' ').trim();
  const bracketText = match[2].trim();

  const rawTerms = bracketText.split(/\s*x\s*/i);
  const terms = [];

  for (const raw of rawTerms) {
    const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (m) {
      const volNum = parseFloat(m[1]);
      const satStr = m[2].trim();
      if (!isNaN(volNum) && volNum > 0) {
        terms.push({ vol: volNum, sat: satStr });
      }
    }
  }

  return { cleanUraian, terms };
}

/**
 * Helper to parse volume and unit from strings like "240.0 pkt" or "500.0 Orang"
 */
function parseVolSat(str) {
  if (!str || typeof str !== 'string') return { vol: null, sat: '' };
  const m = str.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (m) {
    return { vol: parseFloat(m[1]), sat: m[2].trim() };
  }
  const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
  if (!isNaN(num)) return { vol: num, sat: '' };
  return { vol: null, sat: str.trim() };
}

/**
 * Step 2: Restructure intermediate worksheet data into 20-column RAB Format Baru
 * Columns A..T (1..20):
 * A: KODE, B: URAIAN, C: VOL RO, D: JENIS KOMPONEN, E: Vol1, F: Sat1, G: x, H: Vol2, I: Sat2, J: x,
 * K: Vol3, L: Sat3, M: x, N: Vol4, O: Sat4, P: VOL, Q: SAT, R: HARGASAT, S: JUMLAH, T: TAGGING RM/PNBP
 * @param {ExcelJS.Workbook} workbook
 */
async function restructure(workbook) {
  workbook.worksheets.forEach((worksheet) => {
    // Extract signature info before clearing raw rows
    worksheet.signatureInfo = extractSignatureInfo(worksheet);

    const rows20 = [];

    const rawRows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells = [];
      for (let c = 1; c <= 25; c++) {
        cells.push(getCellText(row.getCell(c)));
      }
      rawRows.push(cells);
    });

    for (let i = 0; i < rawRows.length; i++) {
      const cells = rawRows[i];

      // Skip non-table footer / signature / notes rows (n+1..n+6)
      if (isFooterRow(cells)) {
        continue;
      }

      let colA = (cells[0] || '').trim();
      let colB = (cells[1] || '').trim();
      let colC = (cells[2] || '').trim();
      let colD = (cells[3] || '').trim();
      let colE = (cells[4] || '').trim();
      let colF = (cells[5] || '').trim();
      let colG = (cells[6] || '').trim();

      let rawColH = (cells[7] || '').trim();
      let rawColJ = (cells[9] || '').trim();
      let rawColK = (cells[10] || '').trim();
      let rawColL = (cells[11] || '').trim();
      let rawColM = (cells[12] || '').trim();
      let rawColN = (cells[13] || '').trim();
      let rawColO = (cells[14] || '').trim();

      // Normalize 1-column shift if JUMLAH is shifted from colJ (col 10) to colK (col 11)
      let colJ = rawColJ;
      let colK = rawColK;

      const numJ = parseFloat(rawColJ.replace(/[^0-9.-]/g, ''));
      const numK = parseFloat(rawColK.replace(/[^0-9.-]/g, ''));

      if ((!colJ || isNaN(numJ)) && !isNaN(numK) && numK > 1000) {
        colJ = rawColK; // Shift JUMLAH from K to J
        colK = '';      // Clear K so it doesn't get picked up as tagging
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

      if (!code && !rawUraian) continue;

      // Multi-line header consolidation: Check if subsequent raw rows have the exact same code OR are blank-code continuation lines
      if (code && code !== '-' && code !== '>' && code !== '>>') {
        while (i + 1 < rawRows.length) {
          const nextCells = rawRows[i + 1];
          if (isFooterRow(nextCells)) break;

          const nextColA = (nextCells[0] || '').trim();
          const nextColB = (nextCells[1] || '').trim();
          const nextColC = (nextCells[2] || '').trim();
          const nextCode = nextColA || nextColB || nextColC;

          const nextColD = (nextCells[3] || '').trim();
          const nextColE = (nextCells[4] || '').trim();
          const nextColF = (nextCells[5] || '').trim();
          const nextUraian = nextColD || nextColE || nextColF;

          const nextHargasat = (nextCells[7] || '').trim();
          const nextJumlah = (nextCells[9] || '').trim();

          const isSameCode = nextCode && nextCode === code;
          const isBlankCodeContinuation = !nextCode && nextUraian &&
            !nextColD.startsWith('-') && !nextColD.startsWith('>') &&
            !nextColE.startsWith('-') && !nextColE.startsWith('>') &&
            !nextHargasat && !nextJumlah;

          if (isSameCode || isBlankCodeContinuation) {
            // Next row is a consecutive multi-line header continuation of the current code
            if (nextUraian) {
              rawUraian += ' ' + nextUraian;
            }
            if (!colG && nextCells[6]) colG = nextCells[6].trim();
            if (!rawColH && nextCells[7]) rawColH = nextCells[7].trim();
            if (!colJ && nextCells[9]) colJ = nextCells[9].trim();
            if (!colK && nextCells[10]) colK = nextCells[10].trim();
            i++; // Advance loop to consume the continuation row
          } else {
            break;
          }
        }
      }

      const { cleanUraian, terms } = parseMultipliers(rawUraian);
      const { vol: numVolG, sat: satG } = parseVolSat(colG);

      let vol1 = '', sat1 = '', x1 = '';
      let vol2 = '', sat2 = '', x2 = '';
      let vol3 = '', sat3 = '', x3 = '';
      let vol4 = '', sat4 = '';

      if (terms.length > 0) {
        vol1 = terms[0] ? terms[0].vol : '';
        sat1 = terms[0] ? terms[0].sat : '';
        if (terms.length > 1) {
          x1 = 'x';
          vol2 = terms[1].vol;
          sat2 = terms[1].sat;
        }
        if (terms.length > 2) {
          x2 = 'x';
          vol3 = terms[2].vol;
          sat3 = terms[2].sat;
        }
        if (terms.length > 3) {
          x3 = 'x';
          vol4 = terms[3].vol;
          sat4 = terms[3].sat;
        }
      }

      let volRo = '';
      let jenisKomponen = '';
      if (PATTERNS.CODE_433.test(code)) {
        volRo = numVolG || '';
        jenisKomponen = 'PENDUKUNG';
      }

      let finalSat = satG || (terms.length > 0 ? terms[terms.length - 1].sat : '');

      let hargasat = rawColH ? parseFloat(rawColH.replace(/[^0-9.-]/g, '')) : '';
      if (isNaN(hargasat)) hargasat = '';

      let jumlah = colJ ? parseFloat(colJ.replace(/[^0-9.-]/g, '')) : '';
      if (isNaN(jumlah)) jumlah = '';

      // Tagging extraction from colK, colL, colM, colN, colO
      let tagging = '';
      const taggingCandidates = [colK, rawColL, rawColM, rawColN, rawColO];
      for (const cand of taggingCandidates) {
        const t = cand.trim().toUpperCase();
        if (t === 'RM' || t === 'PNBP' || t === 'PNP' || t === '*' || t.includes('*')) {
          if (t === 'PNP') tagging = 'PNBP';
          else if (t.includes('RM')) tagging = 'RM';
          else if (t.includes('PNBP')) tagging = 'PNBP';
          else if (t.includes('*')) tagging = '*';
          else tagging = t;
          break;
        }
      }

      rows20.push([
        code,          // Col 1 (A)
        cleanUraian,   // Col 2 (B)
        volRo,         // Col 3 (C)
        jenisKomponen, // Col 4 (D)
        vol1,          // Col 5 (E)
        sat1,          // Col 6 (F)
        x1,            // Col 7 (G)
        vol2,          // Col 8 (H)
        sat2,          // Col 9 (I)
        x2,            // Col 10 (J)
        vol3,          // Col 11 (K)
        sat3,          // Col 12 (L)
        x3,            // Col 13 (M)
        vol4,          // Col 14 (N)
        sat4,          // Col 15 (O)
        numVolG !== null ? numVolG : '', // Col 16 (P)
        finalSat,      // Col 17 (Q)
        hargasat,      // Col 18 (R)
        jumlah,        // Col 19 (S)
        tagging,       // Col 20 (T)
      ]);
    }

    // Overwrite existing rows directly starting at Row 1
    const oldRowCount = worksheet.rowCount;
    for (let r = 0; r < rows20.length; r++) {
      const row = worksheet.getRow(r + 1);
      row.values = rows20[r];
    }

    // Clear and trim excess rows if previous count was larger
    if (oldRowCount > rows20.length) {
      for (let r = rows20.length + 1; r <= oldRowCount; r++) {
        worksheet.getRow(r).values = [];
      }
      worksheet.spliceRows(rows20.length + 1, oldRowCount - rows20.length);
    }
  });
}

module.exports = restructure;
