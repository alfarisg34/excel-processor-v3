const { execSync } = require('child_process');
const path = require('path');

const releases = [
  {
    version: '3.9.0',
    date: '2026-10-27',
    type: 'MINOR',
    title: 'Grouping Excel Berjenjang dan Rencana Optimasi Rekap',
    changes: [
      {
        type: 'FEAT',
        title: 'Outline Excel dan Label Tingkat',
        desc: 'Kolom A menampilkan label tingkat. Outline +/- dan tombol 1–7 pada hierarki penuh mengikuti Grand Total, Satker, Kegiatan, KRO, RO, Komponen dan Subkomponen. Induk di atas rincian, header ikut terlipat bersama rincian satker, seluruh grup terbuka saat diunduh. Fokus tanpa leluhur merapatkan kedalaman grup; kolom B:I dan posisi rumus tetap, area gulir mulai A8 dengan freeze tujuh baris.'
      },
      {
        type: 'FIX',
        title: 'Warna Umum untuk Semua Cabang',
        desc: 'Sorotan jingga khusus KRO 2175.QDC/2175.QEA milik BBPKK Bandung Barat dan turunannya dihapus. Seluruh cabang, termasuk label A, memakai profil warna tingkat yang sama untuk setiap satker.'
      },
      {
        type: 'DOCS',
        title: 'Rencana Percepatan Inspect dan Rekap Gabungan',
        desc: 'improvement.md mencatat alur saat ini, baseline lokal, eksperimen pembacaan tanpa pembangunan merge dan reuse sumber, serta rencana instrumentasi, loader bersama, cache, pemeriksaan inkremental, payload/render dan pembatalan. Angka eksperimen hanya berlaku pada sampel yang diuji; optimasi belum diimplementasikan. README, PRD, Architecture, Schema dan Design diselaraskan; AGENTS.md ditinjau tanpa perubahan. Package, lockfile dan label UI memakai 3.9.0.'
      },
      {
        type: 'FIX',
        title: 'Pembanding Audit RKK Opsional',
        desc: 'Tes audit melaporkan skip ketika output lama pembanding tidak tersedia. Audit sintetis dan sampel nyata tetap berjalan; error pembacaan lain dan assertion pembanding yang tersedia tetap menggagalkan tes.'
      },
      {
        type: 'TEST',
        title: 'Regresi Rekap dan XLSX',
        desc: 'Regresi mencakup outline/label setelah serialisasi XLSX, summary di atas rincian, seluruh grup terbuka, batas satker/cabang, fokus/terminal, formula/target dan kesamaan fill/font QDC/QEA dengan profil umum. Suite rekap mencakup metadata, batch, API, simulasi DOM frontend dan audit RKK; sinkronisasi versi, sintaks script dan git diff --check diperiksa.'
      },
      {
        type: 'TEST',
        title: 'Batas Pemeriksaan',
        desc: 'Integrasi opsional lima workbook, perbandingan template SATIG dan pembanding output lama audit RKK dilewati karena sampel lokal tidak lengkap. Pemeriksaan visual browser/Microsoft Excel belum dilakukan untuk rilis ini. Varian kolom RKK L/N/Q belum didukung; optimasi performa dalam improvement.md tetap pekerjaan mendatang.'
      }
    ]
  },
  {
    version: '3.8.0',
    date: '2026-10-22',
    type: 'MINOR',
    title: 'Tahun Rekap Opsional, Tambah Unit dari Dropdown dan Sidebar Mobile',
    changes: [
      {
        type: 'FEAT',
        title: 'Tahun Anggaran Rekap Opsional',
        desc: 'Tahun boleh kosong pada UI; manifest API boleh menghilangkan fiscalYear atau mengirim null. Backend memakai input atau satu tahun terdeteksi, lalu null jika tidak diketahui. Ringkasan dan metadata ekspor menjelaskan tahun tidak ditentukan. Tahun terdeteksi yang berbeda antar sumber tetap ditolak sebelum filter unit diterapkan.'
      },
      {
        type: 'UI',
        title: 'Tambah Unit dari Dropdown Pemilik dan Penanggung Jawab',
        desc: 'Opsi + Tambah unit baru membuka dialog nama dan langsung memilih unit pada dropdown asal. Nama kosong/duplikat ditolak; Batal/Escape mempertahankan pilihan sebelumnya. Perubahan pemilik tetap membutuhkan konfirmasi ulang.'
      },
      {
        type: 'FIX',
        title: 'Sidebar Mobile dan Petunjuk Kesiapan Rekap',
        desc: 'Hamburger mobile memakai handler sidebar yang benar dan memperbarui aria-expanded. Petunjuk dekat tombol rekap menjelaskan pemilik belum dipilih/dikonfirmasi, duplikat pemilik, dan tahun tidak sesuai.'
      },
      {
        type: 'DOCS',
        title: 'Dokumentasi dan Versi Rilis Diselaraskan',
        desc: 'README.md, PRD.md, Architecture.md, Schema.md dan Design.md menjelaskan perilaku terbaru. Package, lockfile dan label UI diselaraskan ke 3.8.0; AGENTS.md ditinjau tanpa perubahan. Artefak browser .playwright-mcp/ diabaikan oleh Git. Keterbatasan pemetaan kolom RKK tetap didokumentasikan; format volume L, harga N dan jumlah Q belum didukung.'
      },
      {
        type: 'TEST',
        title: 'Regresi API, Batch, DOM dan Browser',
        desc: 'Suite rekap mencakup tahun kosong/null/tidak dikirim, inferensi dan validasi tahun, penolakan lintas tahun, serta tambah unit dari dropdown. Browser memverifikasi rekap tanpa tahun senilai Rp 38.544.975.000, tambah/pilih pemilik dan PJ, duplikat nama, Batal/Escape dialog, navigasi mobile 390 × 844 dan lipat/perluas sidebar desktop 1280 × 900. Sinkronisasi versi, API changelog aktif, sintaks script dan git diff --check diperiksa.'
      },
      {
        type: 'TEST',
        title: 'Batas Pemeriksaan',
        desc: 'Integrasi opsional lima workbook dilewati karena sampel lokal tidak lengkap. Pemeriksaan visual Microsoft Excel belum dilakukan. RKK (10) masih ditolak karena posisi kolom berbeda; masalah ini hanya didiagnosis dan tidak diperbaiki pada rilis ini.'
      }
    ]
  },
  {
    version: '3.7.0',
    date: '2026-10-13',
    type: 'MINOR',
    title: 'Ekspor Excel Hirarki dengan Template SATIG per Satker',
    changes: [
      {
        type: 'FEAT',
        title: 'Format SATIG Kegiatan-KRO-RO',
        desc: 'Satu sheet dengan baris awal kosong, grand total, blok per satker dan header berulang. Rincian sampai Subkomponen memakai profil font, border, warna, accounting dan lebar kolom dari template; format sebelumnya dengan metadata, Program/Akun, outline dan sheet tambahan diganti.'
      },
      {
        type: 'FEAT',
        title: 'Target Renja dari Volume RKK dan Subtotal Anak Langsung',
        desc: 'Target dan satuan KRO/RO menggunakan volume RKK. Unit Cost memakai target positif dan mempertahankan nilai pecahan. Subtotal menjumlahkan anak langsung hasil fokus/pencarian; formula menyimpan hasil perhitungan termasuk dana nol.'
      },
      {
        type: 'FEAT',
        title: 'Unduhan ExcelJS dari Backend',
        desc: 'Endpoint POST /api/recap-hierarchy/export menghasilkan XLSX. Tombol unduh menampilkan loading, mencegah klik ganda, memakai timeout, menolak hasil usang dan pulih setelah error. Profil template disertakan dalam repository sehingga deployment tidak membutuhkan file context.'
      },
      {
        type: 'DOCS',
        title: 'Dokumentasi Sistem dan Aturan Sebelum Push',
        desc: 'Architecture.md, Schema.md dan Design.md mendokumentasikan sistem; README.md dan PRD.md diselaraskan dengan ekspor SATIG. Package, lockfile, changelog aplikasi dan label UI memakai versi 3.7.0. AGENTS.md menetapkan pemeriksaan sebelum push; summary.md dihapus dan digantikan rujukan dokumentasi tersebut.'
      },
      {
        type: 'TEST',
        title: 'Verifikasi Ekspor SATIG dan Rilis',
        desc: 'Suite rekap memeriksa API unduhan, simulasi DOM, audit RKK serta XLSX: satu sheet, lima blok/header, sumber dana, formula, target kosong/nol/pecahan, fokus/pencarian, freeze dan style. Format dibandingkan dengan template lokal; sinkronisasi versi package/lockfile, label UI, dokumen dan API changelog aktif, sintaks serta git diff --check diperiksa.'
      },
      {
        type: 'TEST',
        title: 'Batas Pemeriksaan',
        desc: 'Integrasi lima workbook operasional dilewati karena sampel tidak lengkap. Pemeriksaan visual browser dan Microsoft Excel belum dilakukan.'
      }
    ]
  },
  {
    version: '3.6.1',
    date: '2026-10-12',
    type: 'PATCH',
    title: 'Perbaikan Level Excel Rekap Hirarki & Dokumentasi PRD',
    changes: [
      {
        type: 'FIX',
        title: 'Level Outline Selaras dengan Baris Hirarki',
        desc: 'Header berada di luar kelompok dan seluruh baris Program sampai Akun, termasuk akun terakhir, memperoleh kedalaman yang sesuai. Tombol 1–7 mengikuti tujuh tingkat struktur pada ekspor penuh.'
      },
      {
        type: 'FIX',
        title: 'Tombol Lipat pada Induk dan Fokus Cabang',
        desc: 'Ringkasan kelompok berada di atas rincian; induk fokus memulai outline dari kedalaman nol. Metadata baris disertakan saat penulisan XLSX dan pencarian tanpa hasil tidak mengunduh struktur kosong.'
      },
      {
        type: 'DOCS',
        title: 'PRD Berdasarkan Sistem yang Tersedia',
        desc: 'PRD.md mendokumentasikan alur RAB/FA, validasi, rekap batch, atribusi, filter, ekspor, API, batas operasional, kriteria penerimaan dan keterbatasan implementasi.'
      },
      {
        type: 'TEST',
        title: 'Regresi Outline Excel',
        desc: 'Pengujian frontend mencakup header, tujuh tingkat, akun terakhir, fokus cabang dan pencarian. Serialisasi SheetJS 0.18.5 pada sampel lokal diverifikasi untuk 569 baris hirarki dengan seluruh nilai tabel tetap sama; pemeriksaan visual Microsoft Excel belum dilakukan.'
      }
    ]
  },
  {
  "version": "3.6.0",
  "date": "2026-10-12",
  "type": "MINOR",
  "title": "Normalisasi Uraian Multibaris & Validasi Seluruh Hirarki",
  "changes": [
    {
      "type": "FEAT",
      "title": "Normalisasi Uraian dan Penelusuran Baris Sumber",
      "desc": "Header, grup dan detail terpisah dikenali sebagai entitas logis dengan pemeriksaan konteks dan angka. Seluruh baris asal disimpan; kasus ambigu meminta koreksi sumber."
    },
    {
      "type": "FEAT",
      "title": "Audit Struktur dan Subtotal Seluruh Level",
      "desc": "Rekap dan proses memeriksa hirarki sampai akun, grup dan detail; peringatan detail identik serta perbedaan volume × harga tetap terlihat."
    },
    {
      "type": "FIX",
      "title": "Formula Subtotal Menghitung Anak Langsung",
      "desc": "Formula SEMULA, MENJADI, REALISASI dan SISA tidak lagi menjumlahkan induk sekaligus keturunannya. Detail langsung dan grup bertingkat dihitung sekali."
    },
    {
      "type": "FIX",
      "title": "Rincian Validasi Langsung di Halaman",
      "desc": "Laporan lengkap dimuat otomatis sehingga batas header HTTP tidak mengosongkan tabel. Program, detail, subtotal, koreksi dan diagnostik tampil dengan loading, retry dan perlindungan respons usang."
    },
    {
      "type": "FIX",
      "title": "Status dan Ringkasan Selisih yang Akurat",
      "desc": "Selisih anggaran memakai total program; detail hilang/tambahan, pasangan ambigu dan error formula memengaruhi status. Selisih yang saling meniadakan tidak menghasilkan klaim sesuai."
    },
    {
      "type": "TEST",
      "title": "Regresi Workbook, API, Frontend dan FA",
      "desc": "Workbook (11) menghasilkan 1.665 detail dan rekap Rp117.302.994.000. Formula output menyisakan Rp299 perbedaan perkalian/pembulatan yang tetap dilaporkan; kasus multibaris, nested FA dan tampilan laporan lengkap diuji."
    }
  ]
},
  {
    "version": "3.5.0",
    "date": "2026-10-12",
    "type": "MINOR",
    "title": "Multiple Upload Rekap Hirarki Satker, Filter Dinamis & Indikator Loading",
    "changes": [
      {
        "type": "FEAT",
        "title": "Rekap Gabungan dari Beberapa File Satker",
        "desc": "Upload beberapa XLSX dengan saran identitas dari isi workbook, konfirmasi unit pemilik dan tahun anggaran, serta mapping penanggung jawab per kegiatan. Kegiatan 2175 dan 6621 tetap terpisah per unit."
      },
      {
        "type": "FEAT",
        "title": "Penelusuran Sumber dan Validasi Batch",
        "desc": "Detail menyimpan file, sheet dan baris sumber. Inspect/batch memvalidasi hash, duplikat atau revisi satu unit/tahun, struktur hirarki dan subtotal; Excel/PDF membawa atribusi sumber."
      },
      {
        "type": "FIX",
        "title": "Ukuran Respons untuk Unit dengan UUID",
        "desc": "Detail dikirim satu kali dan key node memakai ID pendek agar UUID unit tidak membesarkan respons secara berulang. Lima workbook diuji melalui API dengan UUID seperti yang dibuat UI."
      },
      {
        "type": "FIX",
        "title": "Filter Sumber Dana, Status dan Kode Blokir",
        "desc": "Pilihan mengikuti akun dan konteks filter aktif. Detail normal tetap tampil saat kode blokir dibersihkan; pencocokan blokir memakai kode detail dan mengenali detail diblokir tanpa kode."
      },
      {
        "type": "UI",
        "title": "Penjelasan pada Dropdown Filter Kosong",
        "desc": "Dropdown lingkup, akun, sumber dana, status dan kode blokir tetap merespons klik saat kosong dengan alasan dan petunjuk. Pilih Semua/Bersihkan mengikuti ketersediaan opsi."
      },
      {
        "type": "UI",
        "title": "Loading, Pembatalan dan Pemeriksaan Ulang",
        "desc": "Panel loading sticky menampilkan spinner, tahap dan durasi proses serta alasan kontrol sementara terkunci. User dapat membatalkan request dan memeriksa ulang; respons usang dan error tidak meninggalkan loading aktif."
      },
      {
        "type": "FIX",
        "title": "Rincian Blokir dan Lingkup Export",
        "desc": "Fallback kode blokir komponen memakai full path, rincian beberapa kode blokir dipertahankan, dan export struktur mengikuti cabang serta pencarian aktif."
      },
      {
        "type": "IMPROVE",
        "title": "Pengujian Rekap dan Regresi Frontend",
        "desc": "Suite test:recap mencakup metadata, batch, API dan simulasi DOM untuk atribusi, filter, loading, pembatalan, pemulihan error dan empat jalur export."
      }
    ]
  },
  {
    version: '3.4.0',
    date: '2026-09-23',
    type: 'MINOR',
    title: 'Pohon Struktur & Drilldown Hirarki Interaktif, Dual-View Tabs & Analisis Blokir',
    changes: [
      {
        type: 'FEAT',
        title: 'Pohon Struktur & Drilldown Hirarki Interaktif',
        desc: 'Visualisasi hierarki anggaran 7-tingkat (Program s/d Akun) dengan navigasi breadcrumb dinamis, kartu metrik per level (Scope Multi-Tier Cards), popover modal rincian entitas lengkap pencarian dan totalitas, serta tabel pohon interaktif dengan tombol lipat/buka.'
      },
      {
        type: 'FEAT',
        title: 'Dual-View Tabs di Menu Rekap Hirarki Satker',
        desc: 'Menghadirkan tab switcher terpadu antara Tampilan 1: Struktur & Drilldown Hirarki dan Tampilan 2: Analisis Detail Akun cukup dengan satu kali upload file RKK.'
      },
      {
        type: 'FEAT',
        title: 'Ekspor Excel Berjenjang (Native Outline Grouping) & PDF Eksekutif',
        desc: 'Ekspor Excel berjenjang yang memanfaatkan fitur bawaan row.outlineLevel Microsoft Excel untuk melipat baris secara otomatis, serta dokumen PDF landscape A4 siap cetak.'
      },
      {
        type: 'FEAT',
        title: 'Informasi Agregat Kode Blokir Murni (Kode A, Kode 2, dst.)',
        desc: 'Menampilkan ringkasan total blokir murni per kode blokir pada kartu KPI Total Diblokir dan banner lingkup aktif, dilengkapi aksi klik interaktif untuk memfilter tabel akun.'
      },
      {
        type: 'UI',
        title: 'Tata Letak Vertikal Kolom Sumber Dana & Rincian Blokir',
        desc: 'Menyusun rincian sumber dana (RM, PNP, PLN) dan rincian blokir secara vertikal per baris dengan nilai monospaced sejajar agar tabel tampak lebih lapang dan rapi.'
      },
      {
        type: 'FIX',
        title: 'Indikator Panah Toggle Pohon & Penyelarasan Badge Sub-Item',
        desc: 'Ikon panah toggle kini dinamis berubah menjadi chevron-down saat terbuka dan chevron-right saat tertutup. Badge Sub-Item dirapikan dalam satu baris horizontal tanpa terpotong.'
      },
      {
        type: 'FIX',
        title: 'Interaktivitas Checkbox & Tombol Bersihkan Filter Kode Blokir',
        desc: 'Memperbaiki siklus pembaruan filter kode blokir sehingga status uncheck checkbox dan tombol Bersihkan tetap terjaga tanpa ter-reset otomatis.'
      }
    ]
  },
  {
    version: '3.3.2',
    date: '2026-09-23',
    type: 'PATCH',
    title: 'Rincian Blokir Sumber Dana & Kode Blokir Dinamis',
    changes: [
      {
        type: 'FEAT',
        title: 'Rincian Kombinasi Sumber Dana x Kode Blokir',
        desc: 'Menyajikan rincian dana diblokir berdasarkan kombinasi Sumber Dana dan Kode Blokir (contoh: [PNP] Kode A: Rp ..., [PLN] Kode A: Rp ...) pada kartu KPI Total Diblokir lengkap dengan fitur Click-to-Filter.'
      },
      {
        type: 'IMPROVE',
        title: 'Dropdown Multi-Select Kode Blokir Terkategori',
        desc: 'Dropdown filter Kode Blokir kini menyajikan sub-badge per sumber dana pada setiap item kode blokir.'
      },
      {
        type: 'IMPROVE',
        title: 'Sinkronisasi Dinamis Tingkat Hirarki',
        desc: 'Rincian kombinasi blokir otomatis menyesuaikan secara real-time setiap kali pengguna mengganti dropdown Filter Tingkat Hirarki atau Parent Node.'
      }
    ]
  },
  {
    version: '3.3.1',
    date: '2026-09-23',
    type: 'PATCH',
    title: 'Penyempurnaan Tampilan Blok Summary, Garis Cell, & Jeda Kolom Pemisah',
    changes: [
      {
        type: 'IMPROVE',
        title: 'Jeda Kolom Pemisah (Kolom 44 / AR)',
        desc: 'Menambahkan satu kolom kosong sebagai separator di sebelah kiri blok summary dengan lebar proporsional (width: 4).'
      },
      {
        type: 'IMPROVE',
        title: 'Penataan Ulang & Formula 15 Kolom Summary (Kolom 45-59 / AS-BG)',
        desc: 'Memindahkan blok summary ke Kolom 45-59 serta menyinkronkan seluruh formula selisih (SELISIH 524 = AT-AS, SELISIH NON 524 = AW-AV, dst.).'
      },
      {
        type: 'IMPROVE',
        title: 'Garis Cell (Borders) Lengkap',
        desc: 'Menerapkan garis cell tipis hitam (thin border) pada seluruh sisi cell di baris header maupun baris data nilai pada blok summary.'
      },
      {
        type: 'IMPROVE',
        title: 'Pewarnaan Tematik Header Blok Summary (#B8CCE4 & #FFFF00)',
        desc: 'Pewarnaan header blok summary dengan abu-abu/biru lembut #B8CCE4 untuk kolom SEMULA & MENJADI, serta kuning cerah #FFFF00 untuk kolom SELISIH.'
      }
    ]
  },
  {
    version: '3.3.0',
    date: '2026-09-23',
    type: 'MINOR',
    title: 'Kolom Realisasi s/d {DDMMYY}, Pencocokan Berbasis Pagu & Dual Hierarchical SUM',
    changes: [
      {
        type: 'FEAT',
        title: 'Kolom Baru Realisasi s/d {DDMMYY}',
        desc: 'Menambahkan kolom baru langsung di sebelah kanan Kolom AO (Kolom 42 / AP) untuk menyajikan realisasi kumulatif dari kolom s.d. Periode pada dokumen Laporan FA Detail (16 Segmen) dengan format tanggal dinamis DDMMYY.'
      },
      {
        type: 'FEAT',
        title: 'Formula Hirarki Realisasi & Sisa Anggaran',
        desc: 'Formula SUM berjenjang diterapkan otomatis dari level sub-grup (>) dan akun digit 6 hingga level Program (322) secara simetris pada Kolom Realisasi (AP) dan Kolom Sisa Anggaran (AQ).'
      },
      {
        type: 'IMPROVE',
        title: 'Pencocokan Multi-Kriteria Berbasis Pagu (Pagu-Aware Matching)',
        desc: 'Mencegah item dengan uraian sama persis pada kode akun yang sama (misal Fullboard Paket Meeting) tertukar akibat perbedaan urutan antara dokumen RKK dan FA Detail dengan strategi pencocokan dua tahap berbasis verifikasi nominal pagu.'
      },
      {
        type: 'IMPROVE',
        title: 'Penataan Ulang Kolom RAB & Summary',
        desc: 'Kolom Sisa Anggaran dipindahkan ke Kolom 43 (AQ), dan 15 kolom summary bergeser ke Kolom 44-58 (AR-BF) dengan penyesuaian formula selisih dan border styling.'
      }
    ]
  },
  {
    version: '3.2.0',
    date: '2026-09-21',
    type: 'PATCH',
    title: 'Akomodasi Subkomponen Multi-Karakter, Unifikasi Alur & Modern Sidebar Navigation',
    changes: [
      {
        type: 'FEAT',
        title: 'Akomodasi Subkomponen Multi-Karakter',
        desc: 'Mendukung kode subkomponen dengan kombinasi 2 karakter alfabet (seperti AC, ZA, ZB, ZC) pada pattern matching RKK Satker sehingga seluruh rincian kegiatan terurai lengkap tanpa terlewat.'
      },
      {
        type: 'FIX',
        title: 'Koreksi Marker Blokir RK & Blokir Kode A',
        desc: 'Memperbaiki logika deteksi anggaran blokir pada sumber dana PHLN/PLN yang menggunakan penanda RK, serta sinkronisasi otomatis dengan kolom Blokir Kode A.'
      },
      {
        type: 'UI',
        title: 'Collapsible Sidebar Interaktif',
        desc: 'Sidebar kini collapsible (dapat diperkecil ke mode ikon ringkas 72px) dengan transisi animasi halus, tombol toggle hamburger yang ditempatkan langsung di header sidebar berdampingan dengan logo brand, persistence state via localStorage, dan tampilan topbar desktop yang bersih.'
      },
      {
        type: 'UI',
        title: 'Penyederhanaan Tata Letak Sidebar',
        desc: 'Menghapus seksi Sistem & Bantuan serta profil pengembang dari sidebar agar antarmuka lebih bersih dan terfokus pada fitur pemrosesan utama. Akses catatan rilis ditempatkan secara eksklusif pada badge versi di footer halaman.'
      },
      {
        type: 'UI',
        title: 'Transformasi Modern Sidebar Navigation',
        desc: 'Mengubah navigasi horizontal tab bar menjadi Sidebar Menu vertikal yang elegan, responsif (drawer mobile), lengkap dengan brand Kemnaker dan breadcrumb dinamis.'
      },
      {
        type: 'UI',
        title: 'Harmonisasi Narasi Hirarki Satker',
        desc: 'Standardisasi seluruh narasi label hirarki pada UI: Code 322 menjadi Program, Digit 4 menjadi Kegiatan, Code 43 menjadi KRO, Code 433 menjadi RO, Digit 3 menjadi Komponen, dan Single Alpha menjadi Subkomponen.'
      },
      {
        type: 'UX',
        title: 'Unifikasi Alur Pemrosesan & Checklist Realisasi FA',
        desc: 'Menyatukan Alur 1 dan Alur 2 menjadi satu alur pemrosesan terpadu dengan tombol checklist "Dengan Realisasi (FA Detail)". File RKK dapat diproses langsung tanpa Laporan FA, dan upload FA Detail hanya muncul jika opsi dicentang.'
      },
      {
        type: 'UX',
        title: 'Default Filter Hirarki ke Seluruh Satker',
        desc: 'Mengatur opsi bawaan (default) saat halaman dan analisis rekap dimuat langsung menampilkan data tingkat "Seluruh Satker (Total All Level)".'
      },
      {
        type: 'UX',
        title: 'Pencarian Cepat Parent Node / Kode Spesifik',
        desc: 'Menghadirkan dropdown pencarian interaktif (searchable combobox) pada pemilih parent node di modul Rekap Hirarki Satker, mendukung pencarian instan nama & kode kegiatan/KRO/RO/Komponen/Subkomponen, navigasi keyboard (Enter/Escape), serta indikator pagu.'
      },
      {
        type: 'UX',
        title: 'Filter Cerdas & Multi-Select Kode Akun (Default Tercentang Semua)',
        desc: 'Menambahkan dropdown multi-select kode akun beserta pencarian instan untuk mempermudah isolasi dan analisis akun tertentu pada tabel rekap digit 6, dengan seluruh akun tercentang penuh secara default.'
      },
      {
        type: 'UX',
        title: 'Multi-Select Filter Tag Sumber Dana (Multiple Choice)',
        desc: 'Mengubah filter sumber dana menjadi multi-select interaktif (RM, PNP, PLN) serupa filter Akun dengan tombol Pilih Semua dan Bersihkan, mendukung kombinasi seleksi ganda bebas dan default tercentang penuh.'
      },
      {
        type: 'UX',
        title: 'Multi-Select Status Blokir & Kode Blokir (Default Tercentang Semua)',
        desc: 'Mengubah filter Status Blokir (Diblokir & Normal) dan Kode Blokir (Kode A, B, dst.) menjadi komponen dropdown multiple choice interaktif dengan tombol Pilih Semua dan Bersihkan, di mana seluruh pilihan secara bawaan tercentang semua saat awal dimuat.'
      }
    ]
  },
  {
    version: '3.1.0',
    date: '2026-08-24',
    type: 'MINOR',
    title: 'Modul Rekap Hirarki Satker, Sumber Dana PLN (PHLN) & Ekspor Rekap PDF/Excel',
    changes: [
      {
        type: 'FEAT',
        title: 'Modul Rekap Hirarki Satker (Alur 3)',
        desc: 'Ekstraksi komprehensif data anggaran satker, breakdown akun digit 6, navigasi pohon hirarki, serta kalkulasi persentase blokir per node secara otomatis.'
      },
      {
        type: 'FEAT',
        title: 'Dukungan Sumber Dana PLN / PHLN',
        desc: 'Pengenalan dan pemisahan kategori dana Pinjaman/Hibah Luar Negeri (PLN) di samping Rupiah Murni (RM) dan Penerimaan Negara Bukan Pajak (PNBP).'
      },
      {
        type: 'FEAT',
        title: 'Ringkasan 3 Kolom Rekap RAB (Kolom 55-57)',
        desc: 'Penambahan 3 kolom kalkulasi rekap otomatis pada worksheet RAB untuk audit komparasi pagu semula dan menjadi.'
      },
      {
        type: 'UI',
        title: 'Tampilan Kartu Metrik KPI & Tagging Warna',
        desc: 'Visualisasi total pagu, porsi sumber dana (RM biru, PNP hijau, PLN ungu), dan anggaran terblokir dalam bentuk kartu metrik interaktif.'
      },
      {
        type: 'UX',
        title: 'Ekspor Data Rekap Multi-Format (Excel & PDF)',
        desc: 'Fitur unduh data terfilter ke format spreadsheet Excel (.xlsx) dan dokumen cetak PDF resmi dengan tata letak rapi.'
      }
    ]
  },
  {
    version: '3.0.0',
    date: '2026-08-11',
    type: 'MAJOR',
    title: 'Rilis Arsitektur Unified V3: Dual-Mode Pipeline & Validasi Level Hirarki',
    changes: [
      {
        type: 'FEAT',
        title: 'Unified Processing Engine (Alur 1 & Alur 2)',
        desc: 'Penggabungan pipeline pemrosesan standar (Semula Menjadi) dan pemrosesan terintegrasi data Realisasi FA dalam satu dashboard terpadu.'
      },
      {
        type: 'IMPROVE',
        title: 'Engine Formula ExcelJS Dinamis',
        desc: 'Injeksi formula hirarki dinamis 20 kolom berdampingan secara otomatis tanpa resiko formula corrupt pada file spreadsheet berukuran besar.'
      },
      {
        type: 'SECURITY',
        title: 'Validasi Integritas Data & Audit Level',
        desc: 'Pemeriksaan kepatuhan aturan hirarki serta perbandingan total baris sebelum dan sesudah restrukturisasi untuk menjamin integritas data 100% akurat.'
      }
    ]
  },
  {
    version: '2.0.0',
    date: '2026-07-31',
    type: 'MAJOR',
    title: 'Restrukturisasi Format Output RAB 20-Kolom Berdampingan',
    changes: [
      {
        type: 'FEAT',
        title: 'Format RAB 20 Kolom Berdampingan',
        desc: 'Penyajian data Semula dan Menjadi dalam format komparasi 20 kolom sejajar sesuai standar penganggaran Biro Keuangan Kemnaker.'
      },
      {
        type: 'IMPROVE',
        title: 'Optimasi Serverless & Docker Compatibility',
        desc: 'Penyesuaian konfigurasi routing dan build otomatis agar kompatibel penuh dengan lingkungan serverless Vercel maupun standalone Docker container.'
      }
    ]
  }
];

function getGitCommits(limit = 100) {
  try {
    const rootDir = path.resolve(__dirname, '..', '..');
    // Using git log with delimiter
    const stdout = execSync(`git log -n ${limit} --pretty=format:"%h%x09%H%x09%ad%x09%s%x09%an" --date=short`, {
      cwd: rootDir,
      encoding: 'utf8',
      windowsHide: true
    });

    if (!stdout || !stdout.trim()) {
      return [];
    }

    return stdout.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split('\t');
      const shortHash = parts[0] || '';
      const fullHash = parts[1] || '';
      const date = parts[2] || '';
      const message = parts[3] || '';
      const author = parts[4] || '';

      // Determine category from message prefix
      let category = 'OTHER';
      const lower = message.toLowerCase();
      if (lower.startsWith('feat')) category = 'FEAT';
      else if (lower.startsWith('fix')) category = 'FIX';
      else if (lower.startsWith('docs')) category = 'DOCS';
      else if (lower.startsWith('chore')) category = 'CHORE';
      else if (lower.startsWith('refactor')) category = 'IMPROVE';
      else if (lower.startsWith('style')) category = 'UI';
      else if (lower.startsWith('perf')) category = 'IMPROVE';

      return {
        shortHash,
        fullHash,
        date,
        message,
        author,
        category
      };
    });
  } catch (err) {
    console.warn('[Git Commits Extraction Warning]', err.message);
    return [];
  }
}

module.exports = {
  releases,
  getGitCommits
};
