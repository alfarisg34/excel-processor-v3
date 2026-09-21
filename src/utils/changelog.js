const { execSync } = require('child_process');
const path = require('path');

const releases = [
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
