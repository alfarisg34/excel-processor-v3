# Changelog

Semua perubahan penting pada proyek **Excel File Processor V3 (Kemnaker)** akan didokumentasikan dalam file ini.

Format changelog ini mengacu pada panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/),
dan proyek ini menganut standar [Semantic Versioning (SemVer 2.0.0)](https://semver.org/lang/id/).

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
