const fs = require('fs/promises');
const path = require('path');
const sampleNames = [
  'RINCIAN KERTAS KERJA SATKER BBPKK Bandung Barat.xlsx',
  'RINCIAN KERTAS KERJA SATKER BPKK Bekasi.xlsx',
  'RINCIAN KERTAS KERJA SATKER BPKK Kendari.xlsx',
  'RINCIAN KERTAS KERJA SATKER PKK.xlsx',
  'RINCIAN KERTAS KERJA SATKER Ses.xlsx'
];
// Operational workbooks are ignored by Git. Synthetic cases always run;
// optional local integration runs only when all five samples are present.
async function loadSamples() {
  const directory = process.env.RECAP_SAMPLE_DIR || path.join(__dirname, '../context');
  const files = [];
  for (const originalname of sampleNames) {
    try { files.push({ originalname, buffer: await fs.readFile(path.join(directory, originalname)) }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  return files;
}
module.exports = loadSamples;
