const { execSync } = require('child_process');
const path = require('path');

const releases = [
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
