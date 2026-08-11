const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { processExcel } = require('./src/processor');

const app = express();
const PORT = process.env.PORT || 3000;

// Storage configuration for Multer (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Excel Processor V3 API is running' });
});

const validateLevelDifferences = require('./src/utils/level-validator');

// Helper to handle Excel processing response
async function handleProcess(req, res) {
  try {
    const files = req.files || {};
    const mainFile = files['file'] ? files['file'][0] : req.file;
    const faFile = files['fa_file'] ? files['fa_file'][0] : null;

    if (!mainFile) {
      return res.status(400).json({ error: 'File Excel Rencana Kertas Kerja wajib di-upload' });
    }

    const processedWorkbook = await processExcel(mainFile.buffer, faFile ? faFile.buffer : null);

    // Calculate level validation comparison (Sebelum vs Sesudah)
    let validationReport = null;
    try {
      validationReport = await validateLevelDifferences(mainFile.buffer, processedWorkbook);
    } catch (valErr) {
      console.warn('[Validation Calculation Warning]', valErr.message);
    }

    const buffer = await processedWorkbook.xlsx.writeBuffer();

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    const filename = faFile
      ? `output_${timestamp}_Dengan_Realisasi.xlsx`
      : `output_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    if (validationReport) {
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Validation-Summary');
      res.setHeader('X-Validation-Summary', encodeURIComponent(JSON.stringify(validationReport)));
    }

    return res.status(200).send(buffer);
  } catch (error) {
    console.error('[Processor Error]', error);
    return res.status(500).json({
      error: 'Gagal memproses file Excel',
      detail: error.message,
    });
  }
}

const validateInput = require('./src/steps/00-validate-input');
const parseHierarchyRecap = require('./src/utils/hierarchy-recap');

// Multer upload fields configuration
const uploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'fa_file', maxCount: 1 },
]);

// Validate file pattern route
app.post('/api/validate', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'File Excel Rencana Kertas Kerja wajib di-upload' });
    }
    const result = await validateInput(file.buffer);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Validation Error]', error);
    return res.status(500).json({
      error: 'Gagal melakukan validasi file Excel',
      detail: error.message,
    });
  }
});

// Hierarchy Recap route
app.post('/api/recap-hierarchy', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'File Excel Rencana Kertas Kerja wajib di-upload' });
    }
    const recapData = await parseHierarchyRecap(file.buffer);
    return res.status(200).json(recapData);
  } catch (error) {
    console.error('[Recap Hierarchy Error]', error);
    return res.status(500).json({
      error: 'Gagal memproses rekap hirarki file Excel',
      detail: error.message,
    });
  }
});

app.post('/api/process', uploadFields, handleProcess);
app.post('/api/process-with-fa', uploadFields, handleProcess);
app.post('/', uploadFields, handleProcess);

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 Excel Processor V3 Running on http://localhost:${PORT}`);
    console.log(`=================================================`);
  });
}
