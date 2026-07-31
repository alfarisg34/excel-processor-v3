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

    const buffer = await processedWorkbook.xlsx.writeBuffer();

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    const filename = faFile
      ? `output_${timestamp}_Dengan_Realisasi.xlsx`
      : `output_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error('[Processor Error]', error);
    return res.status(500).json({
      error: 'Gagal memproses file Excel',
      detail: error.message,
    });
  }
}

// Routes
const uploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'fa_file', maxCount: 1 },
]);

app.post('/api/process', uploadFields, handleProcess);
app.post('/api/process-with-fa', uploadFields, handleProcess);
app.post('/', uploadFields, handleProcess);

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Excel Processor V3 Running on http://localhost:${PORT}`);
  console.log(`=================================================`);
});
