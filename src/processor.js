const parseInput = require('./steps/01-parse-input');
const restructure = require('./steps/02-restructure');
const formulas = require('./steps/03-formulas');
const mapToRab = require('./steps/04-map-to-rab');
const styling = require('./steps/05-styling');
const faMatching = require('./steps/06-fa-matching');

/**
 * Main processor function
 * @param {Buffer} rkkBuffer - RINCIAN KERTAS KERJA SATKER buffer
 * @param {Buffer} [faBuffer] - Optional Laporan FA Detail buffer
 * @returns {Promise<ExcelJS.Workbook>} Processed ExcelJS Workbook
 */
async function processExcel(rkkBuffer, faBuffer = null) {
  // Step 1: Read & parse input
  const workbook = await parseInput(rkkBuffer);

  // Step 2: Restructure data (splits, shifts, cleanup)
  await restructure(workbook);

  // Step 3: Formulas (volume multiplication, hierarchical SUM)
  await formulas(workbook);

  // Step 4: Map to RAB layout + SEMULA/MENJADI/SELISIH + Summary columns
  const outWorkbook = await mapToRab(workbook);

  // Step 5: Styling (Font Arial 6pt, row colors, headers, borders)
  await styling(outWorkbook);

  // Step 6: Laporan FA Matching (if FA file provided)
  if (faBuffer) {
    await faMatching(outWorkbook, faBuffer);
  }

  return outWorkbook;
}

module.exports = {
  processExcel,
};
