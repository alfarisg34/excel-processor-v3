# Changelog

Semua perubahan penting pada proyek **Excel File Processor V3 (Kemnaker)** akan didokumentasikan dalam file ini.

Format changelog ini mengacu pada panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/),
dan proyek ini menganut standar [Semantic Versioning (SemVer 2.0.0)](https://semver.org/lang/id/).

---

## [Unreleased]

### Added
- Architecture.md, Schema.md, dan Design.md berdasarkan kode saat ini, dilengkapi diagram alur, kontrak workbook/API, batas operasional, perilaku antarmuka dan ekspor, serta indeks dokumentasi di README.md.
- Aturan proyek di AGENTS.md: setiap git push wajib didahului pembaruan changelog, peninjauan dan pembaruan dokumen terdampak, serta pemeriksaan perubahan yang akan dikirim.

### Changed
- Excel struktur memakai satu template SATIG Kegiatan-KRO-RO: baris awal kosong, grand total, blok per satker dan header berulang, rincian sampai Subkomponen, serta profil font/border/warna/accounting/lebar kolom dari file contoh. Format sebelumnya dengan metadata, Program/Akun, outline dan sheet tambahan diganti.
- Target/satuan KRO dan RO menggunakan volume RKK; Unit Cost memakai target positif dan menjaga nilai pecahan. Subtotal menggunakan formula anak langsung hasil fokus/pencarian dengan cached result, termasuk dana nol.
- Excel struktur dibuat oleh ExcelJS backend melalui POST /api/recap-hierarchy/export; tombol unduh memiliki loading, pencegahan klik ganda, timeout, penolakan hasil usang dan pemulihan error. Format template disertakan di repository tanpa ketergantungan pada file context saat deployment.
- README.md, PRD.md, Architecture.md, Schema.md dan Design.md diselaraskan dengan format dan endpoint baru.

### Removed
- summary.md dihapus; dokumentasi sistem saat ini dirujuk melalui README.md, PRD.md, Architecture.md, Schema.md, dan Design.md.

### Validation
- Suite npm run test:recap lulus, mencakup API unduhan XLSX dan simulasi DOM alur export. Pengujian SATIG menulis/membaca XLSX untuk memeriksa satu sheet, lima blok/header, funding, formula anak langsung, target kosong/nol/pecahan, fokus/pencarian, freeze dan style. Lebar kolom, font, border dan format angka dibandingkan dengan file contoh lokal.
- Pemeriksaan sintaks server.js dan satig-hierarchy-export.js serta git diff --check lulus sebelum push.
- Integrasi lima workbook operasional dilewati karena sampel tidak lengkap. Pemeriksaan visual browser/Microsoft Excel belum dilakukan. Tidak ada perubahan versi rilis.

## [3.6.1] - 2026-10-12

### Added
- PRD.md berdasarkan implementasi sistem saat ini: alur RAB/FA, validasi, rekap batch, atribusi sumber, filter, ekspor, API, batas operasional, dan kriteria penerimaan.
- Pengujian regresi outline Excel untuk header, tujuh tingkat hirarki, akun terakhir, fokus cabang, pencarian, dan hasil kosong.

### Fixed
- Level outline ekspor Excel rekap hirarki tidak lagi bergeser satu baris; header tetap di luar kelompok dan Program sampai Akun memperoleh kedalaman yang sesuai.
- Tombol lipat memakai induk di atas rincian sehingga kelompok mengikuti cabang hirarki, dengan level 1–7 menampilkan Program sampai Akun pada ekspor penuh.
- Ekspor fokus cabang memulai outline dari kedalaman nol pada induk fokus; metadata baris disertakan saat penulisan XLSX dan pencarian tanpa hasil tidak menghasilkan unduhan struktur kosong.

## [3.6.0] - 2026-10-12

### Added
- Normalisasi uraian multibaris bersama untuk detail/header/grup, provenance semua baris asal, audit struktur dan rekonsiliasi subtotal sampai level akun dan grup.
- Validator sumber/output seluruh level, evaluator formula tanpa cached result, deteksi detail hilang/tambahan, serta laporan JSON lengkap dengan tautan sementara.
- Regresi kasus RKK (11), grup/detail tiga baris, formula nested/campuran, angka nol, siklus, dan status validasi UI/API.

### Fixed
- Rincian validasi dimuat otomatis dari laporan lengkap dan ditampilkan di halaman, termasuk program/detail/subtotal, normalisasi dan diagnostik; ringkasan header terpotong tidak lagi meninggalkan tabel kosong. Loading, retry, timeout dan respons usang ditangani.
- Detail sumber 1380–1381 dihitung sekali dan header grup 2482–2483 digabung sebelum pemrosesan.
- Formula S/AM/AP/AQ menjumlahkan anak langsung sehingga induk dan keturunannya tidak dihitung bersamaan.
- Ringkasan selisih anggaran memakai total program; selisih detail terpisah dan kegagalan evaluasi tidak ditampilkan sebagai valid.

## [3.5.0] - 2026-10-12

### Added
- Multiple upload XLSX pada Rekap Hirarki Satker, pemeriksaan bukti isi, konfirmasi pemilik/tahun, serta penanggung jawab per kegiatan.
- Rekap gabungan dengan kegiatan terpisah per unit, termasuk 2175 dan 6621, filter pemilik/penanggung jawab, serta sumber file/sheet/baris pada detail dan Excel/PDF.
- Endpoint inspect/batch, validasi manifest berbasis hash isi, penolakan duplikat/revisi satu unit/tahun, rekonsiliasi subtotal, serta respons detail yang dikirim sekali.
- Suite integrasi lima workbook, API, dan simulasi DOM frontend melalui npm run test:recap.

### Fixed
- Upload/pemeriksaan dan pembuatan rekap menampilkan panel loading sticky, spinner, durasi, alasan kontrol terkunci, pembatalan, dan pemeriksaan ulang; respons usang serta error tidak meninggalkan loading aktif.
- Status Blokir mengikuti akun/pencarian aktif; lima dropdown filter kosong tetap merespons klik dengan penjelasan, indikator informasi, dan state aksesibilitas.
- Filter sumber dana/kode blokir mengikuti akun, status, dan pencarian aktif; detail normal tidak hilang saat kode blokir dibersihkan, dan blokir tanpa kode dikenali per detail.
- Key hirarki pada respons batch dipadatkan agar UUID unit dari UI tidak menyebabkan lima file kecil melewati batas hasil JSON 4 MiB; ditambahkan regresi API lima file dengan UUID.
- Konteks fallback kode blokir komponen memakai full path, dan akun dengan beberapa kode blokir mempertahankan rincian per kode.
- Export struktur mengikuti cabang dan pencarian aktif; perubahan upload/atribusi membersihkan hasil lama.

## [3.4.0] - 2026-09-23

### Added (FEAT)
- **Pohon Struktur & Drilldown Hirarki Interaktif (Hierarchical Tree & Scope Drilldown Inspector)**:
  - **Eksplorasi Menyeluruh 7 Tingkat Hirarki**: Visualisasi hierarki berjenjang komprehensif mulai dari Level 1 (Program) $\rightarrow$ Level 2 (Kegiatan) $\rightarrow$ Level 3 (KRO) $\rightarrow$ Level 4 (RO) $\rightarrow$ Level 5 (Komponen) $\rightarrow$ Level 6 (Subkomponen) $\rightarrow$ hingga Level 7 (Akun Digit 6).
  - **Contextual Scope Inspection**:
    - Saat berada di level atas (Seluruh Satker), sistem menyajikan berapa total Program (misal `2 Program`), apa saja dan anggarannya, berapa total Kegiatan (misal `5 Kegiatan`), apa saja dan anggarannya, hingga berapa total Akun (misal `58 Akun`) di seluruh satker.
    - Saat pengguna masuk/fokus ke level Program, lingkup analisis otomatis mengunci ke program tersebut dan menyajikan rincian turunan di bawahnya: berapa total kegiatan di program tersebut, s/d berapa total akun dan nominal anggarannya masing-masing.
    - Begitu pula saat masuk ke Kegiatan, KRO, RO, Komponen, dan Subkomponen.
  - **Scope Multi-Tier Cards & Quick Modal**:
    - Kartu metrik dinamis untuk setiap level di bawah lingkup aktif yang menampilkan jumlah entitas dan total nominal pagunya.
    - Tombol `[👁️ Lihat Rincian]` pada setiap kartu level untuk memunculkan popover modal berisi daftar lengkap kode, nama/uraian, nominal pagu, sumber dana (RM/PNP/PLN), total blokir, dan rincian kode blokir disertai fitur pencarian instan dan totalitas (*grand total*).
  - **Interactive Collapsible Tree Grid**:
    - Tabel pohon dengan tombol ekspansi (`▶` / `▼`), indentasi visual berjenjang, penanda level berwarna, dan tombol `[🎯 Fokus ke Level Ini]`.
    - Tombol pintasan level cepat: `[L1: Program]`, `[L2: Kegiatan]`, `[L3: KRO]`, `[L6: Subkomponen]`, `[Buka Semua]`, dan `[Tutup Semua]`.
    - Kotak pencarian pohon instan dengan auto-expansion path ke entitas yang cocok.
  - **Ekspor Excel Berjenjang (Native Outline Grouping)**:
    - Menghasilkan buku kerja Excel berjenjang yang memanfaatkan fitur bawaan *Excel Row Outline Grouping* (`row.outlineLevel`) sehingga pengguna dapat langsung menekan tombol lipat `[+]` dan `[-]` di Microsoft Excel.
  - **Ekspor PDF Rekap Struktur Eksekutif**:
    - Laporan PDF landscape A4 siap cetak dengan ringkasan lingkup aktif dan tabel berjenjang berwarna.

### Changed (UI/UX)
- **Dual-View Switcher di Rekap Hirarki Satker**:
  - Menyediakan tab switcher bersih di bagian atas hasil analisis:
    - **Tab 1: 🌳 Struktur & Drilldown Hirarki** (Tampilan Baru Default)
    - **Tab 2: 🔍 Analisis Detail Akun** (Filter Spesifik)
  - Pengguna hanya perlu mengunggah file RKK satu kali untuk mengakses kedua mode analisis secara instan.
- **Informasi Agregat Kode Blokir Murni (Kode A, Kode 2, dst.)**:
  - Menampilkan ringkasan total blokir murni per kode blokir (misal `Kode A: Rp 15.824.165.000`, `Kode 2: Rp ...`) di samping breakdown per sumber dana pada kartu KPI dan banner lingkup aktif.
- **Tata Letak Vertikal Kolom Sumber Dana & Rincian Blokir**:
  - Mengubah tampilan item sumber dana (`RM`, `PNP`, `PLN`) dan rincian blokir pada tabel pohon struktur dan modal quick list menjadi tersusun rapi secara vertikal (*stacked column*) per baris dengan nilai monospaced sejajar, sehingga tabel tampak lebih lapang, tidak saling bertumpuk, dan mudah dibaca.

### Fixed (BUGFIX)
- **Indikator Panah Toggle Pohon Hirarki**:
  - Memperbaiki ikon panah toggle pada tabel pohon berjenjang agar dinamis berubah menjadi panah ke bawah (`fa-chevron-down`) saat baris dalam kondisi terbuka (*expanded*), dan kembali menjadi panah ke kanan (`fa-chevron-right`) saat baris tertutup (*collapsed*).
  - Menambahkan styling warna aksen aktif (`#38bdf8`) dan efek hover saat tombol toggle dalam status terbuka.
- **Penyelarasan Badge Kolom Sub-Item (`.tree-subitem-badge`)**:
  - Memperbaiki teks jumlah sub-item dan header `SUB-ITEM` yang sebelumnya terpotong atau terlipat ke baris bawah (`4` di atas dan `item` di bawah) akibat kompresi lebar kolom.
  - Menambahkan styling pill badge khusus dengan `white-space: nowrap`, `min-width` proporsional, serta pemisahan angka tebal dan label unit (`[ 4 item ]`) dalam satu baris horizontal yang rapi.
- **Interaktivitas Checkbox & Tombol Bersihkan Filter Kode Blokir**:
  - Memperbaiki masalah di mana checkbox pilihan kode blokir (misal *Kode A*) tidak dapat di-uncheck dan tombol *Bersihkan* tidak merespons.
  - Masalah disebabkan oleh pemanggilan fungsi `updateBlockCodeFilterDropdown()` yang mereset status centang secara otomatis setiap kali fungsi perenderan tabel dipanggil ulang. Kini fungsi tersebut dilindungi kondisi `rebuildCodeFilter` sehingga status centang/bersihkan tetap terjaga (*persisted*).

---

## [3.3.2] - 2026-09-23

### Added (FEAT)
- **Rincian Blokir Berdasarkan Sumber Dana dan Kode Blokir**:
  - Menghitung dan menyajikan rincian dana yang diblokir berdasarkan kombinasi Sumber Dana $\times$ Kode Blokir (misalnya `[RM] Kode 2: Rp ...`, `[PNP] Kode A: Rp ...`, `[PLN] Kode A: Rp ...`) pada kartu KPI *Total Diblokir*.
  - Menyediakan *interactive badge click*: pengguna dapat mengklik badge kombinasi sumber dana & kode blokir pada kartu KPI untuk langsung memfilter tabel akun Digit 6 ke kombinasi tersebut secara instan.
  - Memperkaya dropdown filter *Kode Blokir* (`btnMultiSelectD6BlockCode`) pada tabel akun agar menampilkan sub-badge per-sumber dana di setiap item kode blokir.
  - Memperbarui ekspor Excel dan PDF untuk mencantumkan rincian lengkap kombinasi Sumber Dana $\times$ Kode Blokir pada metadata filter dan ringkasan.

### Improved (UI/UX)
- **Sinkronisasi Dinamis dengan Dropdown Filter Hirarki**:
  - Menyelaraskan kartu KPI *Total Diblokir* dan rincian Sumber Dana $\times$ Kode Blokir agar otomatis menyesuaikan secara dinamis (*real-time*) setiap kali pengguna mengganti dropdown *Filter Tingkat Hirarki* (Level 1: Program, Level 2: Kegiatan, dst.) maupun *Parent Node / Kode Spesifik*.

---

## [3.3.1] - 2026-09-23

### Improved (UI/UX & STYLING)
- **Penyempurnaan Tampilan Blok Summary & Jeda Kolom Pemisah**:
  - Menambahkan jeda satu kolom kosong di sebelah kiri blok summary pada **Kolom 44 (AR)** dengan lebar proporsional (width: 4) sebagai pemisah bersih antara tabel utama dan tabel rekapitulasi samping.
  - Memindahkan 15 kolom summary ke **Kolom 45–59 (AS–BG)** dan menyinkronkan seluruh formula selisih (`SELISIH 524` = `AT-AS`, `SELISIH NON 524` = `AW-AV`, `SELISIH RM` = `AZ-AY`, `SELISIH PNBP` = `BC-BB`, `SELISIH PLN` = `BF-BE`).
  - Menambahkan garis cell (*thin black border*) lengkap pada seluruh sisi cell baik pada baris header (Row Y) maupun baris data nilai (Row Y+1).
  - Memberikan warna header tematik: abu-abu/biru lembut `#B8CCE4` untuk seluruh kolom SEMULA & MENJADI, serta kuning cerah `#FFFF00` untuk seluruh kolom SELISIH dengan font hitam tebal dan alignment terpusat (*center/middle*).
  - Memperbarui styling header Kolom AP (`REALISASI\ns/d\n{DDMMYY}`) dan AQ (`SISA\nANGGARAN`) dengan fill `#B8CCE4`, font hitam `#000000`, teks kapital, dan line break (*enter*).

---

## [3.3.0] - 2026-09-23

### Added (FEAT)
- **Kolom Baru Realisasi s/d {DDMMYY} (Kolom 42 / AP)**: Menambahkan kolom baru langsung di sebelah kanan Kolom AO untuk menampilkan nilai realisasi kumulatif yang bersumber dari kolom `s.d. Periode ` pada Laporan FA Detail (16 Segmen). Tanggal proses dinamis otomatis diformat `DDMMYY` pada header kolom.
- **Formula Hirarki Realisasi & Sisa Anggaran**: Menerapkan formula penjumlahan berjenjang otomatis (*hierarchical SUM*) dari level sub-grup `>` dan akun digit 6 hingga level Program (322) secara simetris pada Kolom Realisasi (AP) dan Kolom Sisa Anggaran (AQ).

### Improved (IMPROVE)
- **Pencocokan Multi-Kriteria Berbasis Pagu (Pagu-Aware Matching)**: Mengimplementasikan strategi pencocokan dua tahap (*two-pass matching*) dengan verifikasi nominal Pagu Revisi FA terhadap Pagu RKK Satker. Mencegah item dengan uraian identik dalam satu akun yang sama (seperti *"Fullboard Paket Meeting"*) tertukar penempatan sisa anggaran dan realisasinya akibat perbedaan urutan antara dokumen RKK dan Laporan FA.
- **Relasi Matematis Anggaran**: Menjamin integritas perhitungan bahwa $\text{Realisasi} + \text{Sisa Anggaran} = \text{Nominal Pagu}$.
- **Penataan Ulang Kolom Summary**: Menggeser Kolom Sisa Anggaran ke Kolom 43 (AQ) serta memindahkan 15 kolom summary ke Kolom 44–58 (AR–BF) dengan formula selisih dan border yang disesuaikan secara presisi.

---

## [3.2.0] - 2026-09-21

### Added (FEAT)
- **Akomodasi Subkomponen Multi-Karakter**: Mendukung pattern matching kode subkomponen 1 hingga 3 karakter alfabet (seperti `AC`, `ZA`, `ZB`, `ZC`) pada RKK Satker sehingga seluruh rincian kegiatan terurai lengkap tanpa terlewat.
- **Checklist Realisasi FA**: Penambahan tombol toggle dinamis *"Dengan Realisasi (FA Detail)"* pada form pemrosesan.
- **Halaman `/changelog` & API**: Penambahan antarmuka catatan rilis dark-theme terkurasi dan endpoint `/api/changelog` yang membaca riwayat live commit Git secara langsung dari repository.
- **Lencana Versi di Footer**: Lencana pill kapsul `v3.2.0` ditempatkan khusus di footer halaman yang mengarahkan langsung ke halaman release notes `/changelog`.

### Changed (UI/UX)
- **Collapsible Sidebar Interaktif**: Menjadikan sidebar fleksibel dapat diperkecil (*collapsible*) ke mode ikon ringkas (72px) dengan transisi mulus, tombol toggle hamburger terintegrasi langsung di dalam header sidebar berdampingan dengan logo brand, penyimpanan status di `localStorage`, dan topbar desktop yang bersih.
- **Penyederhanaan Tata Letak Sidebar**: Menghapus seksi "Sistem & Bantuan" dan profil pengembang dari sidebar agar fokus sepenuhnya pada alur kerja utama aplikasi (Pemrosesan RAB & Rekap Hirarki). Akses Release Notes terintegrasi lewat pill badge versi di footer.
- **Transformasi Modern Sidebar Navigation**: Mengubah tab bar horizontal menjadi Sidebar Menu vertikal yang elegan, responsif dengan drawer mobile, brand Kemnaker, dan breadcrumb dinamis.
- **Unifikasi Alur Pemrosesan**: Menghapus pemisahan kaku Alur 1 dan Alur 2 menjadi satu alur pemrosesan terpadu di mana file RKK dapat diproses langsung tanpa keharusan mengunggah file FA.
- **Default Filter Hirarki ke Seluruh Satker**: Opsi bawaan filter tingkatan hirarki dan node parent otomatis terpilih pada *"Seluruh Satker (Total All Level)"*.
- **Harmonisasi Narasi Hirarki Satker**: Standardisasi label: *Code 322* ➡️ **Program**, *Digit 4* ➡️ **Kegiatan**, *Code 43* ➡️ **KRO**, *Code 433* ➡️ **RO**, *Digit 3* ➡️ **Komponen**, *Single Alpha* ➡️ **Subkomponen**, *Digit 6* ➡️ **Akun**.
- **Pencarian Cepat Parent Node / Kode Spesifik**: Mengubah pemilih parent node menjadi dropdown pencarian interaktif (*searchable select/combobox*) dengan pencarian instan (kode & uraian), navigasi keyboard (Enter/Escape), badge kode visual, serta visualisasi nilai pagu.
- **Filter Cerdas & Multi-Select Akun (Default Tercentang Semua)**: Dropdown pencarian multi-select kode akun pada tabel rekap digit 6 dengan seluruh akun tercentang aktif secara default pada pemuatan awal atau saat beralih target hirarki.
- **Multi-Select Filter Tag Sumber Dana (Multiple Choice)**: Mengubah dropdown filter sumber dana menjadi multi-select interaktif (RM, PNP, PLN) serupa filter Akun dengan tombol *Pilih Semua* dan *Bersihkan*, memungkinkan pemilihan kombinasi fleksibel (RM saja, RM & PNP, PNP & PLN, dll.), serta tercentang penuh secara default.
- **Multi-Select Status Blokir & Kode Blokir (Default Tercentang Semua)**: Mengubah filter Status Blokir (Diblokir & Normal) dan Kode Blokir (Kode A, Kode B, dst.) menjadi komponen dropdown multiple choice interaktif dengan tombol *Pilih Semua* dan *Bersihkan*, di mana seluruh pilihan secara bawaan (*by default*) tercentang semua saat awal dimuat, serta terintegrasi penuh dengan ekspor Excel dan PDF.

### Fixed (FIX)
- **Koreksi Marker Blokir RK & Blokir Kode A**: Memperbaiki deteksi tagging `RK` pada sumber dana PHLN/PLN serta sinkronisasi otomatis pengelompokan anggaran blokir PLN (Rp 15.248.000.000) ke dalam **Kode Blokir A** (Total Kode A: Rp 15.824.165.000).
- **Rule 7 Validation Fix**: Menghilangkan *false positive* duplikasi akun di bawah subkomponen multi-huruf yang sebelumnya keliru dianggap `NO_PARENT_ALPHA`.

---

## [3.1.0] - 2026-08-24

### Added (FEAT)
- **Modul Rekap Hirarki Satker (Alur 3)**: Ekstraksi komprehensif data anggaran satker, breakdown akun digit 6, navigasi pohon hirarki, serta kalkulasi persentase blokir per node secara otomatis.
- **Dukungan Sumber Dana PLN / PHLN**: Pengenalan dan pemisahan kategori dana Pinjaman/Hibah Luar Negeri (PLN) di samping Rupiah Murni (RM) dan Penerimaan Negara Bukan Pajak (PNBP).
- **Ringkasan 3 Kolom Rekap RAB (Kolom 55-57)**: Penambahan 3 kolom kalkulasi rekap otomatis pada worksheet RAB (`PLN SEMULA`, `PLN MENJADI`, `SELISIH PLN`) untuk audit komparasi pagu.
- **Ekspor Data Multi-Format**: Kemudahan unduh data terfilter ke format spreadsheet Excel (.xlsx) dan dokumen cetak PDF resmi ber-tabel rapi.

### Changed (UI)
- **Kartu Metrik KPI Interaktif**: Visualisasi total pagu, proporsi sumber dana (RM biru, PNP hijau, PLN ungu), dan rincian anggaran terblokir.

---

## [3.0.0] - 2026-08-11

### Added (FEAT)
- **Unified Processing Engine**: Penggabungan pipeline pemrosesan standar (Semula Menjadi) dan pemrosesan terintegrasi data Realisasi FA dalam satu arsitektur dashboard V3.
- **Dynamic ExcelJS Formula Engine**: Injeksi formula hirarki dinamis 20 kolom berdampingan secara otomatis.

### Security & Integrity
- **Validasi Integritas Data**: Pemeriksaan kepatuhan aturan hirarki serta perbandingan total baris sebelum dan sesudah restrukturisasi untuk menjamin zero data loss.

---

## [2.0.0] - 2026-07-31

### Added (FEAT)
- **Format RAB 20-Kolom Berdampingan**: Penyajian data Semula dan Menjadi dalam format komparasi 20 kolom sejajar sesuai standar penganggaran Biro Keuangan Kemnaker.

### Improved (IMPROVE)
- **Kompatibilitas Serverless & Cloud Deployment**: Konfigurasi routing dan build otomatis agar kompatibel penuh dengan lingkungan serverless Vercel maupun standalone Docker container.
