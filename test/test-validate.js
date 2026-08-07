const fs = require('fs');
const path = require('path');
const validateInput = require('../src/steps/00-validate-input');

async function test() {
  const filePath = path.join(__dirname, '../RINCIAN KERTAS KERJA SATKER.xlsx');
  console.log('Testing validateInput on:', filePath);

  const buffer = fs.readFileSync(filePath);
  const result = await validateInput(buffer);

  console.log('\n--- VALIDATION RESULT ---');
  console.log('Valid:', result.valid);
  console.log('Total Violation Rules Triggered:', result.violations.length);

  result.violations.forEach((v) => {
    console.log(`\n[Rule ${v.ruleId}] ${v.ruleTitle}`);
    console.log(`Description: ${v.patternDesc}`);
    console.log('Details:');
    v.details.forEach((d) => {
      console.log(`  - Code: ${d.code} | Rows: [${d.rows.join(', ')}] | Context: ${d.context}`);
      if (d.taggings) console.log(`    Taggings: ${d.taggings}`);
    });
  });
}

test().catch(console.error);
