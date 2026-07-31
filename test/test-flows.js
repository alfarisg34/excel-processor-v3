const fs = require('fs');
const path = require('path');
const { processExcel } = require('../src/processor');

async function runTests() {
  console.log('==============================================');
  console.log('🧪 Running Excel Processor V3 Flow Verification');
  console.log('==============================================');

  const rkkPath = path.join(__dirname, '..', 'RINCIAN KERTAS KERJA SATKER.xlsx');
  const faPath = path.join(__dirname, '..', 'Laporan Fa Detail (16 Segmen).xlsx');

  if (!fs.existsSync(rkkPath)) {
    console.error('❌ RKK file not found at:', rkkPath);
    process.exit(1);
  }

  const rkkBuffer = fs.readFileSync(rkkPath);
  const faBuffer = fs.existsSync(faPath) ? fs.readFileSync(faPath) : null;

  // --- Test Flow 1: Processing Without FA ---
  console.log('\n▶ Testing Flow 1: Processing Standard (Without FA)...');
  try {
    const wb1 = await processExcel(rkkBuffer, null);
    const buf1 = await wb1.xlsx.writeBuffer();
    const outPath1 = path.join(__dirname, '..', 'test_output_flow1.xlsx');
    fs.writeFileSync(outPath1, buf1);
    console.log('✅ Flow 1 SUCCESS! Output saved to:', outPath1);
    console.log('   Sheet count:', wb1.worksheets.length);
    console.log('   First sheet rows:', wb1.worksheets[0].rowCount);
  } catch (err) {
    console.error('❌ Flow 1 FAILED:', err);
  }

  // --- Test Flow 2: Processing With FA ---
  if (faBuffer) {
    console.log('\n▶ Testing Flow 2: Processing With FA Realisasi...');
    try {
      const wb2 = await processExcel(rkkBuffer, faBuffer);
      const buf2 = await wb2.xlsx.writeBuffer();
      const outPath2 = path.join(__dirname, '..', 'test_output_flow2.xlsx');
      fs.writeFileSync(outPath2, buf2);
      console.log('✅ Flow 2 SUCCESS! Output saved to:', outPath2);
      console.log('   Sheet count:', wb2.worksheets.length);
      console.log('   First sheet rows:', wb2.worksheets[0].rowCount);
    } catch (err) {
      console.error('❌ Flow 2 FAILED:', err);
    }
  }

  console.log('\n==============================================');
  console.log('🎉 Verification Complete!');
  console.log('==============================================');
}

runTests();
