# Schema

Tanggal pembaruan: 22 Oktober 2026. Kontrak berdasarkan implementasi package 3.8.0. Dokumen ini mencakup workbook, objek runtime, serta API; proyek tidak memiliki schema database. Gambaran sistem ada di [Architecture.md](Architecture.md).

## 1. Konvensi

- Nomor baris/kolom Excel dan `rowNum` dimulai dari 1. Indeks array JSON dan `detailIndexes` dimulai dari 0.
- Kode program, kegiatan, akun, komponen, dan KPPN adalah string agar nol awal tetap terjaga.
- Nilai anggaran berupa number dalam rupiah. `blockedPct` dan `matchPercentage` pada JSON berupa string hasil `toFixed(1)` dalam skala 0–100; nilai Excel persen memakai rasio 0–1.
- `sourceId` adalah SHA-256 buffer upload, bukan hash nama file. `ownerId` adalah identitas aplikasi, bukan kode Satker resmi.
- Key node merupakan referensi opaque. Key `N1`, `N2`, dan seterusnya hanya berlaku untuk respons tersebut; jangan menyimpannya sebagai identitas bisnis permanen.
- Field dapat berbeda antara endpoint legacy, model internal, dan batch. Field atribusi batch tidak dijamin tersedia pada respons legacy.

## 2. Hirarki kode

| Level rekap | Tingkat | Pola/contoh |
| --- | --- | --- |
| 0 | Root | `ROOT`, kode `SATKER` |
| 1 | Program | Tiga digit, dua digit, dua alfanumerik: `026.04.DN` |
| 2 | Kegiatan | Empat digit: `2175` |
| 3 | KRO | Empat digit dan tiga alfanumerik: `2175.BDC` |
| 4 | RO | KRO dan tiga alfanumerik: `2175.BDC.001` |
| 5 | Komponen | Tiga digit: `051` |
| 6 | Subkomponen | Satu sampai tiga huruf: `A`, `AC` |
| 7 | Akun | Enam digit: `521211` |

Audit/formula juga mengenali grup `>` dan subgrup `>>`, lalu detail `-`. Level audit tambahan tidak sama dengan level opsi UI rekap: level 8/9 untuk grup/subgrup, level 10 untuk detail. Pola terpusat ada di [patterns.js](src/utils/patterns.js).

## 3. Workbook RKK dan FA

Parser sumber menggunakan konteks hirarki dari baris sebelumnya. Pada RKK, kode biasanya berada di A–C, uraian di D/E, jumlah di J dengan penanganan pergeseran K, dan tagging di L atau kolom sekitar. Detail dapat memakai penanda `-` pada D dengan uraian di E. Normalisasi menangani format sumber yang didukung; posisi ini bukan kontrak untuk semua workbook Excel.

Volume/harga detail dibaca dari G/H. Varian dengan volume di L, harga di N dan jumlah di Q belum dipetakan otomatis: pada sampel RKK (10), baris 19, 20 dan 30 ditolak sebagai jumlah kosong meskipun nilai Q tersedia. Ini merupakan batas parser yang masih terbuka, bukan dukungan format baru pada rilis 3.8.0.

Entitas normalisasi mempertahankan `rowNum` dan `sourceRows`, kode, uraian, jumlah, volume/harga, tagging, serta penanda blokir. Audit menghasilkan `rows`, `findings`, `warnings`, `issues`, `reconciliation`, dan `validationComplete`. Properti `rkkSourceRows` pada row ExcelJS dipakai sebagai provenance runtime; jangan menganggapnya tersimpan sebagai field standar XLSX.

FA menggunakan sheet pertama, mulai dibaca dari baris 9:

| Kolom FA | Isi |
| --- | --- |
| B/C/E/F/H | Konteks program/kegiatan, KRO/RO, komponen, subkomponen, akun |
| N (14) | Uraian detail dengan prefix enam digit |
| Q (17) | Pagu revisi |
| Z (26) | Realisasi sampai periode |
| AE (31) | Sisa anggaran |

Record FA internal: `rawRowNum`, `program`, `kegiatan`, `kro`, `ro`, `fullRo`, `komponen`, `subkomponen`, `akun`, `uraian`, `pagu`, `realisasi`, `sisa`.

## 4. Workbook RAB output

Header berada pada baris 1–3; data mulai baris 4. Nama sheet sumber dipertahankan untuk pencocokan audit.

| Area | SEMULA | MENJADI | Makna |
| --- | --- | --- | --- |
| Kode/uraian | A/B | U/V | Hirarki dan nomenklatur |
| Vol RO/jenis komponen | C/D | W/X | Metadata RO/komponen |
| Rincian perhitungan | E:O | Y:AI | Empat faktor volume, penghubung dan satuan |
| Volume/satuan | P/Q | AJ/AK | Volume total dan satuan |
| Harga/jumlah | R/S | AL/AM | Harga satuan dan jumlah |
| Tagging | T | AN | RM, PNBP, PLN dan penanda terkait |

Kolom AO menyimpan SELISIH (`AM-S`), AP REALISASI, AQ SISA ANGGARAN, AR separator. Ringkasan per RO mulai AS; kelompok meliputi belanja 524/non-524 dan sumber dana. Layout pembentuk header menggunakan 65 kolom, bukan hanya dua blok 20 kolom. Implementasi rinci ada di [04-map-to-rab.js](src/steps/04-map-to-rab.js).

Formula detail mencakup `PRODUCT` faktor volume dan perkalian volume dengan harga. Formula subtotal pada S/AM dan AP/AQ memakai anak langsung. Kolom REALISASI/SISA tersedia pada layout; FA mengisi nilainya jika diberikan.

## 5. Metadata inspeksi dan unit

`POST /api/recap-hierarchy/inspect` menerima multipart `files` berulang dan mengembalikan `{ sources, unitOptions }`.

| Field sumber | Tipe/arti |
| --- | --- |
| `sourceId`, `originalName`, `sheetName` | String identitas isi, nama upload, sheet yang dibaca |
| `size`, `rowCount`, `recordCount`, `totalVal` | Number ukuran byte, baris, detail logis, total |
| `satkerCode`, `satkerName` | String atau null dari header eksplisit |
| `fiscalYear`, `fiscalYears` | Number atau null; array tahun yang terdeteksi |
| `locations`, `kppnCodes`, `programCodes`, `activityCodes` | Array string |
| `activities` | Array `{ programCode, code, name }` |
| `candidates`, `ownerSuggestion` | Unit `{ id, name }`; saran dapat null |
| `identificationStatus` | `suggested`, `ambiguous`, atau `unresolved` |
| `evidence` | Maksimal 100 bukti `{ sheetName, cell, text, type, unitId?, programCode, activityCode }` |
| `validation` | Hasil validator input, termasuk `valid` dan `violations` |
| `reconciliation`, `normalizationFindings`, `auditWarnings`, `structuralIssues` | Temuan audit sumber |
| `validationComplete`, `valid` | Boolean; kelengkapan audit dan kelayakan sumber |

File yang gagal inspect dapat hanya memiliki `{ sourceId, originalName, valid: false, error }`. Jangan mengakses field metadata lengkap tanpa memeriksa ketersediaannya.

Unit bawaan berasal dari [unit-registry.js](src/config/unit-registry.js). Registry memuat id/name serta alias, lokasi, dan KPPN untuk identifikasi. Unit yang dikirim sebagai pilihan API memakai `{ id, name }`.

## 6. Manifest batch

`POST /api/recap-hierarchy/batch` menerima multipart `files` berulang dan satu field `manifest` berupa JSON string. Contoh struktur; placeholder hash wajib diganti dengan `sourceId` hasil inspect:

```json
{
  "fiscalYear": 2027,
  "customUnits": [{ "id": "custom-direktorat-pkk", "name": "Direktorat PKK" }],
  "sources": [{
    "sourceId": "<SHA-256 hasil inspect>",
    "ownerId": "bpkk-bekasi",
    "confirmed": true,
    "activityAssignments": [{
      "programCode": "026.04.WA",
      "activityCode": "6621",
      "responsibleUnitId": "custom-direktorat-pkk"
    }]
  }],
  "filters": { "ownerId": "", "responsibleUnitId": "" }
}
```

Aturan manifest:

- `fiscalYear` opsional (boleh dihilangkan atau null); jika diisi wajib integer 2000–2100. Jumlah sources harus sama dengan jumlah file.
- Setiap hash harus cocok dengan isi upload, unik, dan pemilik wajib dikenal serta `confirmed === true`.
- Satu pemilik hanya boleh memiliki satu file aktif dalam batch. File identik ditolak meski namanya berbeda.
- Tahun eksplisit sumber harus sama antar file dan cocok dengan tahun input jika diisi. Tanpa input, tahun batch memakai satu tahun yang terdeteksi; jika tidak ada tahun terdeteksi, tahun batch null. File dengan tahun tidak diketahui tetap dapat direkap.
- Mapping PJ memakai pasangan program/kegiatan yang benar-benar ada; satu pasangan tidak boleh dipetakan dua kali. Default PJ adalah pemilik sumber.
- `customUnits` opsional, maksimal 50. ID cocok dengan `^custom-[a-z0-9-]{1,64}$`; nama tidak kosong, maksimal 150 karakter, tanpa karakter kontrol, dan tidak duplikat setelah trim/penyeragaman huruf.
- Filter kosong berarti semua. Nilai terisi harus merujuk unit yang dikenal.

## 7. Respons rekap batch

| Field | Isi |
| --- | --- |
| `schemaVersion`, `fiscalYear`, `filters` | Versi 2, tahun batch (number atau null), filter server |
| `rootSummary`, `nodeSummaries` | Ringkasan root dan dictionary node keyed by key |
| `levelOptions`, `nodesByLevel`, `childrenMap` | Navigasi tingkat 0–6 dan relasi node ringkasan |
| `hierarchyTree` | Pohon rekursif termasuk akun level 7 |
| `activityCodeCount`, `activityBranchCount` | Kode kegiatan unik vs cabang per unit/konteks |
| `unitOptions`, `sources`, `assignments`, `perFileValidation` | Unit, bukti sumber, pemetaan, validasi per file |
| `compactDetails`, `detailRecords` | Flag true dan daftar detail unik pada wire JSON |

Sumber batch menambah `ownerId`, `ownerName`, dan `included`. Sumber yang tersaring tetap dapat muncul dengan `included: false`.

Ringkasan node memuat `key`, `code`, `name`, `level`, `levelName`, `parentKey`, `fullPath`, `totalVal`, `totalRM`, `totalPNBP`, `totalPLN`, `blockedRM`, `blockedPNBP`, `blockedPLN`, `totalBlocked`, `blockedPct`, `blockedByCodeList`, `blockedBySourceAndCodeList`, `digit6List`, `childrenKeys`, `directChildrenCount`, dan `accountCount`. Node batch juga membawa `sourceIds`/`unitIds`; cabang mulai kegiatan memiliki atribusi owner/PJ.

`digit6List` mengelompokkan akun menurut kode dan tagging. Agregat akun memiliki total, blokir, `code`, `name`, `tagging`, `blockCode`, serta daftar detail. Pada wire JSON, daftar detail diganti `detailIndexes`. Browser mengembangkannya menjadi `details` dari `detailRecords` sebelum render, lalu menghapus properti pemadatan. Node pohon menggunakan `children` rekursif; jangan menganggap semua properti ringkasan tersedia pada node pohon.

Detail yang diserialisasi untuk akun membawa `rowNum`, `sourceRows`, `uraian`, `val`, `tagging`, `blockCode`, `blockMarker`, `isBlocked`, dan atribusi batch: `sourceId`, `originalName`, `sheetName`, `ownerId`, `ownerName`, `responsibleUnitId`, `responsibleUnitName`, `recordId`, `fullPath`. Record canonical internal juga mempunyai pasangan kode/nama `c322`, `d4`, `c43`, `c433`, `d3`, `alpha`, dan `d6`; jangan mengasumsikan field internal tersebut hadir pada detail wire.

`recordId` dibentuk dari hash sumber, nama sheet, dan nomor baris. `sourceRows` tetap memuat semua baris yang bergabung menjadi satu detail. Daftar blokir memakai `{ code, val }` atau `{ tag, code, val }`. PNBP ditampilkan sebagai `PNP` pada daftar kombinasi sumber dana; blokir tanpa kode menggunakan label `Tanpa Kode`.

## 8. Validasi sumber/output dan FA

`POST /api/validate` menerima `file` dan mengembalikan hasil pemeriksaan input. Laporan perbandingan sesudah konversi berbeda: `schemaVersion: 2`, `overallStatus` (`MATCH`, `DIFF`, `INCOMPLETE`), `validationComplete`, hitungan match/diff/missing/added, total detail dan total program, serta array temuan.

Field utama angka: `totalItemsCount`, `matchCount`, `diffCount`, `totalBefore`, `totalAfter`, `totalDiff`, `rawDetailBefore`, `totalBudgetBefore`, `totalBudgetAfter`, `totalBudgetDiff`, `absoluteDetailDiff`, `subtotalDiffCount`, `programDiffCount`, `normalizationCount`, `structuralIssueCount`, `sourceMismatchCount`, `diagnosticCount`.

Array laporan: `programSummary`, `sourceIssues`, `sourceWarnings`, `sourceReconciliation`, `normalizationFindings`, `diagnostics`, `subtotalDiscrepancies`, `discrepancyItems`, `sampleAllItems`. Array terakhir adalah sampel maksimal 30 detail, bukan seluruh detail yang cocok. Item perbandingan memuat sheet, baris asal/output, sourceRows, path, level, kode, uraian, tagging, nilai sebelum/sesudah, diff, dan status. Status item juga dapat `MISSING` atau `ADDED`; subtotal menambah `leafTotal` dan `formulaDifference`. Nilai tidak tersedia dapat null, bukan nol.

Respons proses menyertakan `X-Validation-Summary`, berisi URI-encoded JSON ringkas dengan `reportUrl` dan `completeReportAvailable`. Jika encoded header melebihi 6.500 karakter, array rincian dikosongkan. Laporan lengkap diambil melalui GET URL tersebut. `X-FA-Matching-Summary` memakai encoding yang sama; memuat `totalRkkDetails`, `normalDetailsCount`, `blockedDetailsCount`, `matchedCount`, `unmatchedCount`, `matchPercentage`, `unmatchedItems` (maksimal 100), `blockedItems` (maksimal 150), `allUnmatchedCount`, dan `allBlockedCount`.

## 9. Daftar route dan error

| Metode/path | Input | Respons sukses |
| --- | --- | --- |
| GET `/health` | — | `{ status, message }` |
| GET `/changelog` | — | HTML |
| GET `/api/changelog?limit=100` | Query limit | `{ currentVersion, releases, gitCommits }` |
| POST `/api/validate` | Multipart `file` | JSON validasi input |
| POST `/api/process` | `file`, opsional `fa_file` | XLSX dan header ringkasan |
| POST `/api/process-with-fa` | Sama | Handler yang sama; FA tetap opsional di backend |
| POST `/` | Sama | Alias handler proses |
| POST `/api/recap-hierarchy` | `file` | JSON rekap legacy |
| POST `/api/recap-hierarchy/inspect` | `files` | JSON metadata per file |
| POST `/api/recap-hierarchy/batch` | `files`, `manifest` | JSON rekap batch dipadatkan |
| POST `/api/recap-hierarchy/export` | JSON `items`, `ownerOrder` opsional | XLSX SATIG satu sheet |
| GET `/api/validation-reports/:id` | ID URL laporan | JSON attachment; `Cache-Control: no-store` |

Error JSON umumnya memiliki `error`, opsional `detail` dan `issues`. Batch menggunakan 400 untuk multipart/manifest malformed, 413 untuk batas ukuran/waktu/hasil, 422 untuk sumber atau atribusi invalid, dan 500 untuk kegagalan tak tertangani. Laporan hilang/kedaluwarsa memakai 404. Route legacy tidak memakai wrapper error upload batch; jangan mengasumsikan semua error Multer legacy berbentuk JSON atau memakai pemetaan status yang sama.

## 10. Ekspor rekap berjenjang

POST /api/recap-hierarchy/export menerima JSON items (array wajib, maksimal 30.000 node) dan ownerOrder (array ID pemilik opsional). Payload maksimal 4 MiB. Setiap item memuat key unik, parentKey, level 2–6, code, name, totalVal, totalRM, totalPNBP, totalPLN, serta ownerId/ownerName dan targetRenja/targetUnit opsional. Nilai uang dan target harus finite; target tidak negatif. Relasi induk yang hadir harus satu tingkat di atas anak dan mempunyai pemilik yang sama. Input tidak valid menghasilkan 400; batas ukuran 413. Respons sukses berupa XLSX dengan Content-Disposition attachment, bukan JSON.

Frontend mengirim node hasil fokus/pencarian yang berada pada Kegiatan sampai Subkomponen. Payload berisi hasil rekap di browser; endpoint tidak mengunggah ulang atau memvalidasi sumber RKK. Program dan Akun tetap tersedia di pohon web/PDF, tetapi tidak masuk format Excel SATIG.

Workbook hanya mempunyai sheet Kegiatan-KRO-RO. A tersembunyi, baris 1–3 kosong, label grand total pada B4 dan angka E4:H4, blok pertama mulai baris 5 dengan total satker, header dua baris 6–7, data mulai 8. Blok berikutnya mengulang total satker dan header. Kolom B:I: kode pendek dan uraian, Target Renja, Satuan, ANGGARAN, PNBP, PHLN, RM, Unit Cost. Tidak ada metadata, indentasi, outline atau sheet rincian/atribusi tambahan.

PHLN mengambil totalPLN; PNBP mengambil totalPNBP. Target KRO/RO berasal dari volume kolom G RKK berbentuk angka dan satuan (misalnya 1198000.0 Orang), diteruskan melalui targetRenja (number opsional) dan targetUnit (string opsional) pada node, summary dan tree. Target tidak terbaca tetap kosong; target antar RO/unit tidak dijumlahkan. Unit Cost hanya untuk RO dengan target positif, menggunakan E<baris>/C<baris>.

Subtotal E:H menggunakan referensi anak langsung dalam ekspor. Pada terminal cabang, F/G/H berasal dari nilai rekap dan E menjumlahkan F/G/H. Nilai dana nol terminal dibiarkan kosong seperti template. Grand total menjumlahkan total satker. Formula menyimpan cached result termasuk nol. Total ekspor mengikuti rincian hasil fokus/pencarian. Format accounting mempertahankan nilai asli; tampilan umumnya bulat. Profil format ada pada src/config/satig-export-template.json; detail tampilan di [Design.md](Design.md).
