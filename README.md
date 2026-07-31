# Excel Processor V3 📊

A high-performance Node.js & Express application designed for processing, restructuring, and analyzing Kemnaker Rencana Kerja & Anggaran (RAB / RKK) Excel documents.

It transforms raw RKK Satker input files into a **20-column side-by-side comparison layout (SEMULA vs. MENJADI vs. SELISIH)** matching the **RAB Format Baru** specification, calculates hierarchical budget formulas dynamically, cleans trailing rows, and matches Sisa Anggaran from Laporan FA Detail (16 Segmen).

---

## ✨ Features

- **20-Column RAB Side-by-Side Matrix**:
  - **SEMULA** (Cols 1–20 / A–T): `KODE`, `URAIAN`, `VOL RO`, `JENIS KOMPONEN`, Multiplier breakdown (`Vol1..Sat4`), `VOL` (P), `SAT` (Q), `HARGASAT` (R), `JUMLAH` (S), `TAGGING RM/PNBP` (T).
  - **MENJADI** (Cols 21–40 / U–AN): Mirrored 20-column RAB matrix with automated formula column shifts.
  - **SELISIH** (Col 41 / AO): Dynamic difference formula (`=AM{r}-S{r}`) populated for all active table data rows.
- **Automated Multiplier Parsing**:
  - Automatically parses multiplier expressions in item titles (e.g. `[24 org x 10 kl]`, `[5 org x 6 jpl x 1 kl]`, `[4 org x 1 trip x 9 lok]`) into separate volume and unit columns.
- **Dynamic Hierarchical Formula Recalculation**:
  - Generates 100% mathematically accurate bottom-up `SUM(...)` formulas for all budget account hierarchy levels (`026.04.DN`, `2175`, `2175.BDC`, `051`, `A`, `521211`, `522151`, `524111`, `>`, `>>`).
- **Raw Input Shift Normalization**:
  - Automatically detects and normalizes 1-column shifted raw input rows (e.g. `JUMLAH` and `TAGGING` values shifted to Column K/N).
- **Clean Table Formatting & Signature Block**:
  - Removes non-budget description rows (where both `S` and `AM` are blank) while preserving formula integrity.
  - Automatically appends TTE (Tanda Tangan Elektronik) signature blocks with 5 reserved spacing rows at Column `AL(n+2)`.
  - Applies professional color coding (Dark Blue `#0c0c5e`, Blue `#0000FF`, Red `#B10301`, Calibri `#0070C0` headers, Yellow `#FFFF00` SELISIH).
- **Laporan FA Detail Matching**:
  - Matches 6-digit budget accounts against Laporan FA Detail (16 Segmen) files to compute Sisa Anggaran in Column 51 (`AY`).
- **Web UI & REST API**:
  - Includes a modern drag-and-drop web dashboard accessible via browser and REST endpoints for programmatic processing.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Server Framework**: Express.js
- **Excel Processing Engine**: ExcelJS
- **Middleware**: Multer, CORS
- **Styling & UI**: Modern Vanilla HTML5/CSS3 Web Application

---

## 📁 Project Structure

```text
excel-processor-v3/
├── public/
│   ├── index.html        # Drag-and-drop Web UI interface
│   └── style.css         # Modern dark mode glassmorphism UI styles
├── src/
│   ├── processor.js      # Main processing pipeline coordinator
│   ├── steps/
│   │   ├── 01-parse-input.js   # Unmerges merged cells & parses raw workbook
│   │   ├── 02-restructure.js   # Normalizes raw rows into 20-column RAB matrix
│   │   ├── 03-formulas.js      # Intermediate formula definition step
│   │   ├── 04-map-to-rab.js    # Side-by-side mapping, cleanup, & formula recalculation
│   │   ├── 05-styling.js       # Color coding, fonts, borders, & signature styling
│   │   └── 06-fa-matching.js   # Realisasi & Sisa Anggaran FA matching
│   └── utils/
│       ├── excel-helpers.js    # Cell extraction & border utilities
│       └── patterns.js         # Budget code classification regex patterns
├── test/
│   └── test-flows.js     # End-to-end automated verification suite
├── server.js             # Express API server endpoints
├── package.json          # Node.js project manifest & dependencies
└── README.md             # Project documentation
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v16+ recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/alfarisg34/excel-processor-v3.git
   cd excel-processor-v3
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 🧪 Running Verification Tests

Run the automated test suite to verify Flow 1 (Standard Processing) and Flow 2 (Processing with FA Realisasi):

```bash
node test/test-flows.js
```

---

## 📬 API Endpoints

- `POST /api/process`: Process standard RKK Satker file (Flow 1). Accepts `file` in `multipart/form-data`. Returns transformed Excel document.
- `POST /api/process-with-fa`: Process RKK Satker file with Laporan FA Detail file (Flow 2). Accepts `rkkFile` and `faFile`. Returns transformed Excel document with Sisa Anggaran matching.

---

## 📄 License

MIT License. Developed for Kemnaker Budget & RAB Excel Processing.
