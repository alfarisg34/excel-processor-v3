# Excel Processor V3 📊

A high-performance Node.js & Express application designed for processing, restructuring, validating, and analyzing Kemnaker Rencana Kerja & Anggaran (RAB / RKK) Excel documents.

It transforms raw RKK Satker input files into a **20-column side-by-side comparison layout (SEMULA vs. MENJADI vs. SELISIH)** matching the **RAB Format Baru** specification, calculates hierarchical budget formulas dynamically, cleans SAKTI metadata rows (such as KPPN and Lokasi info), provides pre-upload hierarchy validation, matches Sisa Anggaran from Laporan FA Detail (16 Segmen), and provides an interactive hierarchical tree recap.

---

## ✨ Features & Three Core Workflows (Alur)

### 1. ⚡ Alur 1: Processing Standard (Semula Menjadi)
- **20-Column RAB Side-by-Side Matrix**:
  - **SEMULA** (Cols 1–20 / A–T): `KODE`, `URAIAN`, `VOL RO`, `JENIS KOMPONEN`, Multiplier breakdown (`Vol1..Sat4`), `VOL` (P), `SAT` (Q), `HARGASAT` (R), `JUMLAH` (S), `TAGGING RM/PNBP` (T).
  - **MENJADI** (Cols 21–40 / U–AN): Mirrored 20-column RAB matrix with automated formula column shifts.
  - **SELISIH** (Col 41 / AO): Dynamic difference formula (`=AM{r}-S{r}`) populated for all active table data rows.
- **Automated Multiplier Parsing**:
  - Automatically parses multiplier expressions in item titles (e.g. `[24 org x 10 kl]`, `[5 org x 6 jpl x 1 kl]`, `[4 org x 1 trip x 9 lok]`) into separate volume and unit columns.
- **Dynamic Hierarchical Formula Recalculation**:
  - Generates 100% mathematically accurate bottom-up `SUM(...)` formulas for all budget account hierarchy levels (`026.04.DN`, `2175`, `2175.BDC`, `051`, `A`, `521211`, `522151`, `524111`, `>`, `>>`).
- **Raw Input Shift Normalization & Noise Cleaning**:
  - Automatically normalizes shifted raw input rows (`JUMLAH` and `TAGGING` values shifted to Column K/N).
  - Filters out SAKTI metadata noise rows (e.g. `(KPPN.182-Jakarta VII )` and `Lokasi : ...`) so account names and table rows remain clean.
- **Clean Table Formatting & Signature Block**:
  - Removes non-budget description rows (where both `S` and `AM` are blank) while preserving formula integrity.
  - Automatically appends TTE (Tanda Tangan Elektronik) signature blocks with 5 reserved spacing rows at Column `AL(n+2)`.
  - Professional color coding (Dark Blue `#0c0c5e`, Blue `#0000FF`, Red `#B10301`, Calibri `#0070C0` headers, Yellow `#FFFF00` SELISIH).

### 2. 📊 Alur 2: Processing Dengan Realisasi (Laporan FA Detail)
- **Multi-Criteria Hierarchy Matching**:
  - Matches detail line items (`-`) against Laporan FA Detail (16 Segmen) using strict multi-tier hierarchy: Akun (6-digit) + Komponen (3-digit) + Subkomponen (Single Alpha) + RO + Uraian.
- **Sisa Anggaran in Column 42 (AP)**:
  - Appends Sisa Anggaran (Col 42 / `AP`) directly into the output worksheet.
  - Tracks blocked budget allocations (`*` / `Blokir`), matched records, and unmatched records with real-time UI summary reporting.

### 3. 🌳 Alur 3: Rekap Hirarki Satker
- **Hierarchical Budget Tree Visualization**:
  - Parses and builds a hierarchical tree across all 7 budget levels (Program > Kegiatan > KRO > RO > Komponen > Subkomponen > Akun > Detail).
- **Aggregations & Analytics**:
  - Computes total pagu, RM (Rupiah Murni) vs PNBP breakdown, and Blokir vs Non-Blokir allocations per node.
- **Multi-Level Export**:
  - Export full summary tables or branch drill-downs to Excel or PDF directly from the Web UI.

### 4. 🔍 Pre-Upload Input Validation (7 Hierarchy Rules)
- Automatically inspects raw RKK Satker uploads before processing to detect duplicate code violations:
  - **Rule 1**: Code 322 (Program) duplicate check
  - **Rule 2**: Digit 4 (Kegiatan) duplicate check
  - **Rule 3**: Code 43 (KRO) duplicate check
  - **Rule 4**: Code 433 (RO) duplicate check
  - **Rule 5**: Digit 3 (Komponen) duplicate under the same Code 433 parent
  - **Rule 6**: Single Alpha (Subkomponen) duplicate under the same Digit 3 parent
  - **Rule 7**: Digit 6 (Akun) duplicate under the same Single Alpha parent (distinguishing RM vs PNBP)

---

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Server Framework**: Express.js
- **Excel Processing Engine**: ExcelJS
- **Middleware**: Multer, CORS
- **Styling & UI**: Modern Dark Glassmorphism Web Application (HTML5, Vanilla CSS3, FontAwesome, jsPDF)

---

## 📁 Project Structure

```text
excel-processor-v3/
├── public/
│   ├── index.html              # Modern 3-tab Web UI interface (Alur 1, Alur 2, Rekap)
│   ├── style.css               # Dark mode glassmorphism UI styles
│   └── favicon.svg             # Application logo
├── src/
│   ├── processor.js            # Main processing pipeline coordinator
│   ├── steps/
│   │   ├── 00-validate-input.js # Pre-upload hierarchy duplicate validator (7 Rules)
│   │   ├── 01-parse-input.js    # Unmerges merged cells & parses raw workbook
│   │   ├── 02-restructure.js    # Normalizes raw rows into 20-column RAB matrix & filters KPPN
│   │   ├── 03-formulas.js       # Intermediate volume & sum formulas
│   │   ├── 04-map-to-rab.js     # Side-by-side mapping, cleanup, & formula recalculation
│   │   ├── 05-styling.js        # Color coding, fonts, borders, & signature styling
│   │   └── 06-fa-matching.js    # Realisasi & Sisa Anggaran FA matching (Col 42 / AP)
│   └── utils/
│       ├── excel-helpers.js     # Cell text extraction & border styling utilities
│       ├── hierarchy-recap.js   # Tree parser for Alur 3 hierarchical recap & analytics
│       ├── level-validator.js   # Pre/post conversion level difference validator
│       └── patterns.js          # Budget code classification regex patterns
├── test/
│   ├── test-flows.js           # End-to-end automated verification for Flow 1 & Flow 2
│   ├── test-validate.js        # Test script for 7 hierarchy validation rules
│   └── test-api.js             # API endpoint integration test
├── server.js                   # Express API server endpoints & upload handlers
├── package.json                # Node.js project manifest & dependencies
└── README.md                   # Project documentation
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v16+ recommended, tested with Node v18/v20/v24)
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

3. Start development server:
   ```bash
   npm run dev
   ```
   Or start production server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 🧪 Running Verification Tests

Run the automated test suites:

- **Flow 1 & Flow 2 End-to-End Processing**:
  ```bash
  node test/test-flows.js
  ```

- **Input Validation Rules (7 Rules Check)**:
  ```bash
  node test/test-validate.js
  ```

---

## 📬 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check endpoint |
| `POST` | `/api/validate` | Pre-validation of RKK Satker file for 7 duplicate rules (`multipart/form-data` with `file`) |
| `POST` | `/api/process` | Process standard RKK Satker file into 20-col RAB format (Alur 1) |
| `POST` | `/api/process-with-fa` | Process RKK Satker with Laporan FA Detail into 42-col RAB with Sisa Anggaran (Alur 2) |
| `POST` | `/api/recap-hierarchy` | Parse RKK Satker into hierarchical tree recap JSON data (Alur 3) |

---

## 📄 License

MIT License. Developed for Kemnaker Budget & RAB Excel Processing.
