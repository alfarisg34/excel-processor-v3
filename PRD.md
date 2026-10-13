# PRD — Excel Processor V3 Kemnaker

Tanggal pembaruan: 13 Oktober 2026

Versi aplikasi pada `package.json`: 3.6.1

Status: dokumentasi sistem yang tersedia, termasuk perbaikan ekspor hirarki dalam perubahan ini.

Dokumen pendamping: [Architecture.md](Architecture.md) untuk komponen dan alur sistem, [Schema.md](Schema.md) untuk kontrak data/workbook/API, dan [Design.md](Design.md) untuk perilaku UI serta format ekspor.

## 1. Ringkasan produk

Excel Processor V3 adalah aplikasi web untuk mengolah Rincian Kertas Kerja (RKK) Satker menjadi format RAB, mengintegrasikan Laporan FA Detail, dan menganalisis hirarki anggaran satu atau beberapa unit. Pengguna mengunggah workbook, meninjau validasi, lalu mengunduh hasil Excel atau menggunakan rekap interaktif.

Dokumen ini mengacu pada kode server, pemroses, antarmuka, dan pengujian di repositori. Fitur yang belum tersedia ditulis sebagai keterbatasan, bukan sebagai kemampuan produk.

## 2. Masalah dan tujuan

Pengolahan manual RKK membutuhkan penataan ulang kolom, penjumlahan berjenjang, pemeriksaan duplikasi kode, dan pencocokan realisasi. Rekap beberapa unit juga berisiko mencampurkan kode kegiatan yang sama atau menghitung salinan file dua kali.

Tujuan produk:

- Mempercepat pembuatan RAB SEMULA/MENJADI dengan rumus anggaran berjenjang.
- Menunjukkan perbedaan anggaran sebelum dan sesudah konversi agar hasil dapat diperiksa.
- Memadankan rincian RKK dengan FA berdasarkan konteks hirarki dan nilai pagu.
- Menyediakan analisis pagu, sumber dana, dan blokir sampai tingkat akun dan detail.
- Mempertahankan asal data dan atribusi unit dalam rekap gabungan.
- Menghasilkan Excel berjenjang yang dapat dibuka dan dilipat sesuai induk cabang.

## 3. Pengguna dan ruang lingkup

| Pengguna | Kebutuhan |
| --- | --- |
| Penyusun RAB/operator Satker | Mengonversi RKK dan memeriksa hasil serta rumus |
| Pengelola realisasi | Memadankan FA, meninjau item cocok/tidak cocok dan blokir |
| Analis anggaran/unit | Menelusuri struktur, sumber dana, dan blokir pada lingkup tertentu |
| Koordinator beberapa unit | Menggabungkan workbook dengan pemilik dan penanggung jawab yang jelas |

Antarmuka utama memiliki dua menu: **Pemrosesan Excel** dengan pilihan FA opsional, dan **Rekap Hirarki Satker**. Tiga alur bisnis adalah pemrosesan standar, pemrosesan dengan FA, dan rekap hirarki. Aplikasi tidak menerapkan akun pengguna atau pembagian hak akses menurut peran di atas.

## 4. Input dan model data

### 4.1 Workbook

- Pemrosesan RAB menerima satu RKK dan satu FA opsional. Multer membatasi masing-masing file hingga 50 MiB.
- Pembacaan workbook menggunakan ExcelJS untuk XLSX. Pilihan `.xls` masih muncul di UI pemrosesan, tetapi tidak membuktikan dukungan XLS biner.
- Rekap batch menerima 1–10 XLSX, maksimal 5 MiB per file dan total 20 MiB.
- Rekap batch membaca tabel RKK dari worksheet pertama; workbook maksimal 10 sheet, worksheet pertama maksimal 30.000 baris dan 100 kolom.
- Struktur kode dan posisi data harus dapat dikenali oleh parser RKK/FA; aplikasi bukan konverter semua format Excel.

### 4.2 Hirarki anggaran

| Level struktur | Jenis | Contoh kode |
| --- | --- | --- |
| 1 | Program | `026.04.DN` |
| 2 | Kegiatan | `2175` |
| 3 | KRO | `2175.BDC` |
| 4 | RO | `2175.BDC.001` |
| 5 | Komponen | `051` |
| 6 | Subkomponen | `A` |
| 7 | Akun | `521211` |

Rincian belanja berada di bawah akun. Pemrosesan RAB juga mengenali penanda grup `>`, subgrup `>>`, dan detail `-`. Tabel pohon rekap mengekspor tujuh level struktur sampai Akun; rincian belanja tersedia pada tampilan/ekspor detail akun.

Sumber dana mencakup RM, PNBP (ditampilkan sebagai PNP pada sebagian UI), dan PLN. Informasi blokir mencakup status, nilai, persentase, serta rincian sumber dana dan kode blokir.

### 4.3 Identitas dan asal data batch

Setiap sumber mempunyai fingerprint SHA-256, nama file, sheet, metadata, bukti identifikasi, hasil validasi, dan rekonsiliasi. Pengguna menetapkan tahun anggaran, mengonfirmasi pemilik, dan dapat menentukan penanggung jawab per kegiatan. Detail mempertahankan sumber, sheet, baris, pemilik, penanggung jawab, dan path hirarki.

Key node adalah ID opaque. Konsumen API harus memakai atribut eksplisit untuk membaca kode/unit, bukan mengurai key.

## 5. Kebutuhan fungsional

### FR-01 — Validasi RKK sebelum konversi

Setelah RKK dipilih, UI memanggil validasi dan menampilkan tujuh aturan duplikasi: Program, Kegiatan, KRO, RO, Komponen dalam RO, Subkomponen dalam Komponen, dan Akun dalam Subkomponen dengan pembedaan sumber dana.

Jika aturan terlanggar, UI menyediakan pengakuan pengguna untuk melanjutkan pemrosesan RAB. Pemeriksaan batch lebih ketat: sumber tidak valid tidak boleh menghasilkan rekap gabungan. Validasi UI RAB bukan mekanisme otorisasi pada server.

### FR-02 — Konversi RKK menjadi RAB

Pipeline membaca dan melepas merge input, menormalkan detail/kolom bergeser, menghapus noise metadata seperti KPPN/Lokasi, memecah multiplier volume, menyusun format RAB, membangun ulang rumus, lalu menerapkan styling dan blok tanda tangan.

| Bagian output | Kolom | Isi |
| --- | --- | --- |
| SEMULA | A–T | Matriks 20 kolom dari data awal |
| MENJADI | U–AN | Matriks 20 kolom untuk perubahan |
| SELISIH | AO | Selisih nilai MENJADI dan SEMULA |

Matriks berisi kode, uraian, volume RO, jenis komponen, faktor volume/satuan, volume akhir, satuan, harga satuan, jumlah, dan tagging. Rumus jumlah hirarki menggunakan anak langsung agar subtotal tidak dihitung dua kali. Output tersedia sebagai unduhan `.xlsx`.

### FR-03 — Integrasi FA opsional

Pengguna mengaktifkan pilihan Dengan Realisasi dan mengunggah Laporan FA Detail (16 Segmen). Pemadanan menggunakan konteks program/kegiatan/RO/komponen/subkomponen/akun, normalisasi uraian, dan pemeriksaan pagu sesuai aturan pemroses.

- Realisasi ditempatkan di AP (kolom 42), Sisa Anggaran di AQ (kolom 43).
- Nilai rincian yang cocok diambil dari FA; subtotal AP/AQ dibangun dengan rumus berjenjang.
- Item blokir yang dikenali pemroses dikecualikan dari pemadanan; Realisasi dan Sisa diisi nol.
- Item tidak ditemukan juga diisi nol dan dilaporkan. Nol ini harus dibaca bersama status pemadanan.
- Ringkasan menampilkan jumlah rincian, blokir, cocok/tidak cocok, persentase, dan contoh item bermasalah. Daftar yang dikirim saat ini dibatasi 100 item tidak cocok dan 150 item blokir, disertai jumlah sebenarnya.

### FR-04 — Audit hasil konversi

Server membandingkan anggaran sumber dengan workbook hasil dan mengirim ringkasan pada header `X-Validation-Summary`. UI menampilkan status kelengkapan, jumlah cocok/berbeda, selisih, diagnostik, dan temuan normalisasi/rekonsiliasi yang tersedia. Kegagalan audit menghasilkan status `INCOMPLETE`; hasil tidak boleh dianggap telah tervalidasi penuh.

Laporan lengkap dapat diunduh jika tersedia. Penyimpanannya sementara di memori proses: masa berlaku 10 menit, maksimal 20 laporan, maksimal 32 MiB per laporan dan 64 MiB total. Restart server atau penghapusan laporan karena batas kapasitas dapat membuat tautan tidak tersedia lebih awal.

### FR-05 — Pemeriksaan dan konfirmasi rekap batch

1. Pengguna memilih/drop beberapa XLSX; UI menjalankan inspect.
2. Sistem menampilkan metadata, bukti identifikasi unit, validasi, dan rekonsiliasi per file.
3. Pengguna memilih tahun 2000–2100 dan mengonfirmasi pemilik setiap sumber.
4. Pengguna dapat menambah unit sesi dan memetakan penanggung jawab tiap kegiatan.
5. Sistem membentuk manifest berdasarkan fingerprint isi dan menghasilkan rekap bila seluruh sumber memenuhi aturan.

Saran unit bawaan meliputi BBPKK Bandung Barat, BPKK Bekasi, dan BPKK Kendari. Saran bukan konfirmasi. Tahun footer tanda tangan bukan tahun anggaran. Tahun yang ditemukan di isi harus sesuai tahun batch.

File identik ditolak walaupun namanya berbeda. Satu pemilik/tahun hanya menerima satu sumber aktif; pengguna perlu menghapus salinan/revisi yang tidak dipakai. Pemilik dan penanggung jawab yang berbeda menjaga cabang kegiatan tetap terpisah walaupun kode sama. Batch tidak menghasilkan sukses parsial.

### FR-06 — Rekap dan penelusuran hirarki

Rekap menampilkan total pagu, pembagian RM/PNP/PLN, nilai/persentase blokir, rincian kode blokir, serta jumlah sub-item. Pengguna dapat membuka/menutup node, membuka hingga level tertentu, membuka semua, mencari kode/uraian, dan menjadikan node sebagai fokus lingkup analitik.

Tampilan akun menyediakan penelusuran detail dan filter kode akun, sumber dana, status blokir, kode blokir, serta pencarian uraian. Pilihan filter mengikuti data pada lingkup aktif; filter kosong tetap dapat dibuka dengan penjelasan. Total terfilter dihitung dari rincian yang memenuhi pilihan pengguna.

Filter pemilik/penanggung jawab tersedia untuk batch. Detail mempertahankan atribusi agar pengguna dapat menelusuri nilai kembali ke sumber.

### FR-07 — Ekspor rekap

Produk menyediakan empat jalur unduhan: rekap akun Excel/PDF dan pohon struktur Excel/PDF. Ekspor akun mengikuti filter detail aktif. Ekspor struktur mengikuti fokus cabang dan pencarian struktur; hasil pencarian menyertakan induk yang diperlukan. Ekspor struktur mencakup semua node yang memenuhi kriteria, terlepas dari keadaan buka/tutup tabel web. Ekspor batch menyertakan bagian Sumber dan Atribusi.

Ketentuan Excel berjenjang setelah perbaikan:

- Judul dan metadata lingkup berada di B1:C9, dengan kolom A kosong pada sembilan baris pertama; tabel tetap mulai A11.
- Semua sel tabel memiliki border pada keempat sisi, termasuk sel kosong. Header biru tua dengan teks putih tebal dan teks terbungkus; pagu memakai format angka Excel dan persentase blokir memakai format persen.
- Judul, metadata, dan header tabel berada di luar kelompok outline.
- Induk berada di atas anak; kontrol lipat menggunakan ringkasan di atas rincian (`summaryBelow=false`).
- Level outline dimulai dari nol; ekspor penuh menggunakan Program=0 sampai Akun=6.
- Tombol Excel 1 menampilkan Program, 2 sampai Kegiatan, 3 sampai KRO, 4 sampai RO, 5 sampai Komponen, 6 sampai Subkomponen, dan 7 sampai Akun.
- Melipat satu induk menyembunyikan keturunannya dan mempertahankan induk tersebut serta cabang saudara.
- Ekspor fokus memakai kedalaman relatif: level 1 menampilkan induk fokus. Contoh fokus Komponen memakai Komponen=0, Subkomponen=1, Akun=2, sementara kolom Level tetap menyimpan level bisnis 5/6/7.
- Semua baris data, termasuk Akun terakhir, memperoleh outline yang sesuai. Workbook awalnya terbuka penuh.
- Pencarian tanpa hasil tidak menghasilkan unduhan Excel struktur kosong.

## 6. Antarmuka API

| Metode | Endpoint | Input/hasil utama |
| --- | --- | --- |
| GET | `/health` | Status proses server |
| POST | `/api/validate` | Multipart `file`; JSON hasil validasi |
| POST | `/api/process` | Multipart `file`, `fa_file` opsional; XLSX RAB |
| POST | `/api/process-with-fa` | Handler yang sama dengan proses; FA dipakai jika diberikan |
| POST | `/` | Alias pemrosesan multipart |
| GET | `/api/validation-reports/:id` | Laporan audit sementara; 404 jika tidak tersedia |
| POST | `/api/recap-hierarchy` | Multipart satu `file`; rekap JSON kompatibilitas lama |
| POST | `/api/recap-hierarchy/inspect` | Multipart `files` berulang; sumber dan pilihan unit |
| POST | `/api/recap-hierarchy/batch` | Multipart `files` dan `manifest` JSON; rekap schemaVersion 2 |
| GET | `/api/changelog` | Rilis dan riwayat commit yang tersedia |

Respons batch menyertakan rootSummary, nodeSummaries, childrenMap, hierarchyTree, tahun, sources, assignments, unitOptions, serta jumlah kode/cabang kegiatan. Detail dipadatkan ke `detailRecords` dan direferensikan akun melalui `detailIndexes`; frontend mengembangkan referensi sebelum rendering/ekspor.

Kesalahan batch: 400 untuk multipart/manifest tidak valid, 413 untuk batas ukuran, 422 untuk workbook/identitas/tahun/duplikasi/rekonsiliasi tidak valid. JSON hasil batch dibatasi 4 MiB. Inspect dapat menampilkan kesalahan per sumber untuk ditinjau.

## 7. Kebutuhan nonfungsional dan operasi

- Backend Node.js, Express, Multer memory storage, CORS, dan ExcelJS; frontend HTML/CSS/JavaScript tanpa framework.
- SheetJS 0.18.5 menghasilkan Excel rekap di browser; jsPDF dan AutoTable menghasilkan PDF. Library ekspor dan ikon dimuat dari CDN sehingga bergantung pada akses jaringan browser.
- Workbook upload dan rekap diproses di memori. Tidak ada database atau penyimpanan riwayat workbook permanen pada kode saat ini.
- UI menampilkan loading, mengunci kontrol terkait selama permintaan, dan menyediakan pembatalan/pemulihan. Pembatalan permintaan browser tidak menjamin pekerjaan server telah berhenti.
- Inspect dan batch memeriksa deadline 60 detik antartahap/file; ini bukan penghentian paksa parser yang sedang berjalan.
- Server lokal menggunakan port 3000 atau `PORT`. Entri `api/index.js` dan `vercel.json` menyediakan konfigurasi deployment; batas platform hosting dapat lebih rendah dari batas aplikasi.
- Tidak ada SLA performa atau metrik penggunaan produksi yang ditetapkan dalam implementasi saat ini.

## 8. Kriteria penerimaan dan verifikasi

| Area | Kriteria penerimaan |
| --- | --- |
| RAB standar | Layout A–AO terbentuk; formula subtotal mengikuti anak langsung; audit menunjukkan kecocokan atau selisih secara eksplisit |
| FA | AP/AQ terisi sesuai pemadanan; item tidak cocok/blokir dilaporkan; subtotal mengikuti hirarki |
| Batch | Sumber wajib dikonfirmasi; salinan hash, revisi pemilik/tahun, tahun berbeda, dan rekonsiliasi gagal ditolak |
| Atribusi | Cabang kode sama lintas unit tetap terpisah; detail dan ekspor memuat asal data |
| Filter | Rincian dan total sesuai filter aktif; filter kosong menjelaskan kondisi; loading/pembatalan/error memulihkan UI |
| Outline penuh | Header tetap terlihat; tombol 1–7 mengikuti tujuh tingkat bisnis; Akun terakhir termasuk kelompok yang benar |
| Outline fokus/pencarian | Induk fokus berkedalaman nol; pencarian mempertahankan induk; kelompok sesuai baris data |

Verifikasi tersedia melalui `npm run test:recap` (metadata, batch, API, simulasi DOM frontend, dan audit RKK), `node test/test-flows.js` (alur RAB/FA), dan `node test/test-validate.js` (aturan validasi). Integrasi sampel lokal rekap berjalan hanya ketika sampel yang diperlukan tersedia. Simulasi DOM tidak menggantikan pemeriksaan visual di browser atau Microsoft Excel.

## 9. Keterbatasan dan tindak lanjut

- UI pemrosesan menulis “beberapa” RKK tetapi input/handler pemrosesan menerima satu RKK. Dukungan multi-file tersedia pada rekap batch.
- Teks bantuan FA masih menyebut kolom AV; implementasi aktual memakai AP/AQ. Beberapa dokumentasi lama menyebut 42 kolom, sedangkan output FA mencapai kolom 43.
- Format `.xls` ditawarkan pada UI pemrosesan tetapi dukungan XLS biner tidak tersedia pada pembaca XLSX.
- Pembagian satu kegiatan di dalam satu file ke beberapa penanggung jawab belum didukung; mapping tersedia per kegiatan, bukan alokasi rincian.
- Tidak ada login, persetujuan berjenjang, versioning workbook permanen, kolaborasi simultan, atau integrasi langsung SAKTI pada sistem saat ini.
- Pemeriksaan visual tombol outline pada Microsoft Excel tetap diperlukan sebelum rilis untuk memastikan perilaku aplikasi desktop sesuai hasil metadata/serialisasi.

## 10. Sumber implementasi

- `public/index.html`, `public/recap-batch.js`, `public/style.css`: alur pengguna, filter, ekspor, dan status UI.
- `server.js`, `api/index.js`, `vercel.json`: endpoint, batas upload, laporan audit sementara, deployment.
- `src/processor.js`, `src/steps/00-validate-input.js` sampai `06-fa-matching.js`: validasi dan konversi.
- `src/utils/hierarchy-recap.js`, `hierarchy-recap-batch.js`, `rkk-metadata.js`, `rkk-detail-normalizer.js`, `level-validator.js`: rekap, provenance, normalisasi, audit.
- `src/config/unit-registry.js`, `test/`: unit bawaan dan bukti pengujian.
