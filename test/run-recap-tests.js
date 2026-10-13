async function run() {
  for (const test of ['./test-recap-metadata', './test-recap-batch', './test-recap-api', './test-recap-frontend', './test-satig-export', './test-rkk-audit']) await require(test)();
}
run().catch(error => { console.error(error); process.exitCode = 1; });
