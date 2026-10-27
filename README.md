# Excel Processor V3 📊

A high-performance Node.js & Express application designed for processing, restructuring, validating, and analyzing Kemnaker Rencana Kerja & Anggaran (RAB / RKK) Excel documents.

It transforms raw RKK Satker input files into a **20-column side-by-side comparison layout (SEMULA vs. MENJADI vs. SELISIH)** matching the **RAB Format Baru** specification, calculates hierarchical budget formulas dynamically, cleans SAKTI metadata rows (such as KPPN and Lokasi info), provides pre-upload hierarchy validation, matches Sisa Anggaran from Laporan FA Detail (16 Segmen), and provides an interactive hierarchical tree recap.

Versi saat ini: **3.9.0**. Catatan rilis tersedia pada [CHANGELOG.md](CHANGELOG.md). Rencana optimasi rekap yang belum diimplementasikan tersedia di [improvement.md](improvement.md).

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
- **Realisasi s/d {DDMMYY} in Column 42 (AP) & Sisa Anggaran in Column 43 (AQ)**:
  - Appends Realisasi kumulatif (Col 42 / `AP`) dan Sisa Anggaran (Col 43 / `AQ`) langsung pada worksheet output.
  - Memverifikasi Pagu Revisi FA terhadap Pagu RKK Satker guna mencegah tertukarnya item ber-uraian identik pada kode akun yang sama.
  - Menghitung formula `SUM(...)` hirarki berjenjang dinamis secara simetris untuk kolom Realisasi dan Sisa Anggaran.
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
  - **Rule 1**: Program duplicate check
  - **Rule 2**: Kegiatan duplicate check
  - **Rule 3**: KRO duplicate check
  - **Rule 4**: RO duplicate check
  - **Rule 5**: Komponen duplicate under the same RO parent
  - **Rule 6**: Subkomponen duplicate under the same Komponen parent
  - **Rule 7**: Akun duplicate under the same Subkomponen parent (distinguishing RM vs PNBP vs PLN)

---

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Server Framework**: Express.js
- **Excel Processing Engine**: ExcelJS
- **Excel Export**: Excel struktur memakai ExcelJS backend melalui `/api/recap-hierarchy/export`, satu sheet `Kegiatan-KRO-RO` sesuai SATIG: blok per satker dengan header berulang, rincian sampai Subkomponen, volume RKK sebagai Target Renja, subtotal anak langsung, format accounting dan freeze tujuh baris. Kolom A menampilkan label tingkat; outline `+/-` dan tombol 1–7 pada ekspor penuh dapat melipat Grand Total > Satker > Kegiatan > KRO > RO > Komponen > Subkomponen. File dibuka dengan seluruh rincian terlihat; fokus tanpa leluhur merapatkan kedalaman grup. Excel akun tetap memakai xlsx-js-style 1.2.0 di browser.
- **Middleware**: Multer, CORS
- **Styling & UI**: Modern Dark Glassmorphism Web Application (HTML5, Vanilla CSS3, FontAwesome, jsPDF)

## Aturan sebelum push

Setiap `git push` wajib didahului pembaruan `CHANGELOG.md` dan peninjauan seluruh dokumen yang terdampak, termasuk `README.md`, `PRD.md`, `Architecture.md`, `Schema.md`, dan `Design.md`. Sertakan pembaruan tersebut dalam commit yang dikirim, jalankan pemeriksaan yang sesuai, dan pastikan catatan pengujian mencerminkan hasil sebenarnya. Aturan lengkap ada di [AGENTS.md](AGENTS.md).

## Dokumentasi proyek

| Dokumen | Isi |
| --- | --- |
| [PRD.md](PRD.md) | Tujuan produk, kebutuhan, kriteria penerimaan, dan batas implementasi |
| [Architecture.md](Architecture.md) | Komponen sistem, pipeline RAB/FA, rekap batch, deployment, dan batas operasional |
| [Schema.md](Schema.md) | Layout workbook, hirarki, manifest, payload API, identitas sumber, dan laporan audit |
| [Design.md](Design.md) | Alur UI, status pekerjaan, filter/drilldown, token visual, dan format unduhan |
| [CHANGELOG.md](CHANGELOG.md) | Riwayat perubahan dan catatan Unreleased |
| [improvement.md](improvement.md) | Baseline performa inspect/batch dan rencana optimasi bertahap yang belum diimplementasikan |
| [AGENTS.md](AGENTS.md) | Aturan kerja serta kewajiban sebelum push |


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
│   │   └── 06-fa-matching.js    # Realisasi (Col 42 / AP) & Sisa Anggaran (Col 43 / AQ) FA matching
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

### Multiple Upload Rekap Hirarki Satker

Alur 3 mendukung sampai 10 file XLSX, maksimal 5 MiB per file dan total 20 MiB. Sheet pertama harus berisi tabel RKK, maksimal 30.000 baris dan 100 kolom; workbook maksimal 10 sheet. XLS biner tidak didukung. Batas hasil JSON batch adalah 4 MiB; jika hasil terlalu besar, kurangi sumber atau persempit filter. Target hosting dapat mempunyai batas request/waktu/memory lebih kecil; verifikasi sebelum deployment.

1. Pilih/drop beberapa XLSX. Sistem memeriksa struktur, subtotal dan identitas dari isi workbook.
2. Konfirmasi unit pemilik tiap file. Tahun anggaran opsional dan otomatis terisi jika terdeteksi; tahun footer dan nama file tidak dipakai. Tanpa tahun input maupun tahun terdeteksi, rekap tetap berjalan dengan keterangan tahun tidak ditentukan. File yang diketahui berbeda tahun tidak dapat digabung. Petunjuk di dekat tombol Buat Rekap Gabungan menampilkan syarat yang belum terpenuhi. Saran awal tersedia untuk BBPKK Bandung Barat, BPKK Bekasi dan BPKK Kendari; pilih opsi **+ Tambah unit baru…** pada dropdown pemilik atau penanggung jawab untuk membuat unit dan langsung memilihnya. Dialog dapat dibatalkan tanpa mengubah pilihan sebelumnya.
3. Untuk file campuran, buka bukti/mapping dan pilih penanggung jawab per kegiatan jika berbeda dari pemilik sumber. Unit tambahan berlaku pada sesi halaman tersebut.
4. Buat rekap gabungan, lalu gunakan filter pemilik/penanggung jawab. Kode 2175 maupun 6621 tetap mempunyai cabang terpisah per unit.
5. PDF/Excel akun membawa sumber dan atribusi; detail menampilkan file, sheet, baris, pemilik dan penanggung jawab. Excel struktur SATIG mengelompokkan rincian dalam blok pemilik satker.

Hash isi file mendeteksi salinan walaupun namanya berbeda. Satu unit/tahun hanya menerima satu versi aktif; hapus revisi/salinan yang tidak dipakai. Pembagian 6621 dalam satu file ke beberapa direktorat belum otomatis: perlu mapping yang lebih rinci dan aturan alokasi.

Pembaca RKK masih memakai posisi kolom yang didukung (volume G, harga H, jumlah J/K). Varian dengan volume L, harga N dan jumlah Q seperti RKK (10) belum didukung dan dapat memunculkan pesan jumlah detail kosong. Pemetaan otomatis berdasarkan header belum termasuk rilis 3.8.0.

API baru:

- POST /api/recap-hierarchy/inspect: multipart dengan field files berulang. Respons sources memuat sourceId SHA-256, metadata, evidence, ownerSuggestion, validation, reconciliation, dan valid.
- POST /api/recap-hierarchy/batch: field files berulang serta manifest JSON. Semua owner wajib confirmed; manifest dicocokkan berdasarkan SHA-256 isi, sehingga urutan/nama file tidak menjadi identitas.
- POST /api/recap-hierarchy/export: JSON items level 2–6 dan ownerOrder opsional; maksimal 30.000 node/4 MiB; menghasilkan XLSX SATIG satu sheet.
- Endpoint POST /api/recap-hierarchy dengan field file tetap tersedia.

Contoh manifest:

~~~json
{
  "fiscalYear": 2027,
  "customUnits": [{"id": "custom-direktorat-pkk", "name": "Direktorat PKK"}],
  "sources": [{
    "sourceId": "<SHA-256 dari inspect>",
    "ownerId": "custom-direktorat-pkk",
    "confirmed": true,
    "activityAssignments": [{
      "programCode": "026.04.DN",
      "activityCode": "2175",
      "responsibleUnitId": "custom-direktorat-pkk"
    }]
  }],
  "filters": {"ownerId": "", "responsibleUnitId": ""}
}
~~~

Respons batch schemaVersion 2 mempertahankan rootSummary/nodeSummaries/childrenMap/hierarchyTree, menambahkan sources/assignments/fiscalYear/unitOptions serta jumlah kode/cabang kegiatan. Untuk menghindari duplikasi payload, compactDetails=true menyimpan detail sekali pada detailRecords; setiap akun mempunyai detailIndexes. Frontend mengembangkan indeks menjadi referensi detail sebelum rendering/export. Key node pada respons memakai ID pendek dan bersifat opaque; jangan mengurai key untuk membaca unit atau kode hirarki. sourceId, ownerId, responsibleUnitId, dan fullPath tetap menyediakan identitas serta konteks asli.

Inspect melaporkan masalah per file untuk review. Batch tidak menghasilkan sukses parsial. Kesalahan multipart/manifest memakai 400, batas ukuran 413, serta workbook/identitas/tahun/duplikat/rekonsiliasi invalid 422.

Pengujian rekap (Node.js 20+):

~~~bash
npm run test:recap
~~~

Suite menjalankan fixture sintetis untuk metadata, provenance, filter/mapping, duplikat/revisi, tahun, API lama/baru, loading serta empat export dalam simulasi DOM. Integrasi lima workbook context (13 cabang kegiatan dan lima cabang 6621) dijalankan bila semua sampel lokal tersedia; jika tidak, suite melaporkan bahwa integrasi lokal dilewati. Lokasi sampel dapat diatur melalui RECAP_SAMPLE_DIR. Simulasi DOM memverifikasi logika; pemeriksaan visual browser tetap diperlukan sebelum rilis.
