# Summary implementasi

Tanggal: 12 Oktober 2026
Status: implementasi selesai dan pengujian lulus.

## Hasil pada workbook yang dilaporkan

Sumber: context/RINCIAN KERTAS KERJA SATKER (11).xlsx.

| Pemeriksaan | Hasil |
| --- | --- |
| Detail logis rekap | 1.665 |
| Total rekap berdasarkan jumlah sumber | Rp117.302.994.000 |
| Rekonsiliasi subtotal sumber semua level yang tersedia | Tidak ada selisih |
| Masalah struktur yang menghalangi pemrosesan | Tidak ada |
| Pasangan detail sumber/output baru hilang atau tambahan | Tidak ada |
| Total program pada output hasil formula | Rp117.302.994.299 |
| Selisih output terhadap subtotal sumber | +Rp299 |
| Ketidaksesuaian formula subtotal terhadap leaf output unik | Tidak ada |

Normalisasi mengenali:

- Baris 1093–1094: satu header subkomponen D, “Pelatihan Berjenjang Fungsional Pengantar Kerja Tingkat Muda”.
- Baris 1380–1381: satu detail penginapan, jumlah Rp16.000.000 dihitung sekali.
- Baris 2482–2483: satu grup kegiatan pimpinan Dit PPTKA (Kendari), subtotal Rp60.540.000 dihitung sekali dalam output.

Menggabungkan header grup tidak mengurangi total leaf rekap, karena rekap menghitung detail, bukan menambahkan subtotal header.

Tujuh detail masih berbeda akibat jumlah sumber tidak persis sama dengan volume × harga. Total perbedaannya Rp299: DN +Rp241 dan WA +Rp58. Kebijakan angka tidak diubah untuk memaksa hasil sesuai. Validator tetap berstatus DIFF dan menampilkan perbedaan tersebut; 34 subtotal ancestor yang terdampak ditandai tanpa menjumlahkan selisihnya lintas level.

Output lama yang diberikan tetap terdeteksi memiliki selisih total program +Rp1.101.071.299 oleh validator baru.

## Perubahan yang diterapkan

### Normalisasi dan audit sumber bersama

Modul baru: src/utils/rkk-detail-normalizer.js.

- Membentuk entitas logis dari beberapa baris untuk header berkode, grup, dan detail.
- Mendukung rangkaian tiga baris, kelanjutan tanpa kode, richText, merged cells, serta marker di kolom D/prefix uraian.
- Membandingkan konteks, sumber dana, status blokir, volume, harga, jumlah, serta dukungan subtotal sebelum menggabungkan detail bernilai terulang.
- Mempertahankan semua nomor baris sumber melalui sourceRows.
- Menyimpan koreksi otomatis, masalah struktur, peringatan detail identik, dan perbedaan volume × harga.
- Detail lengkap identik tidak otomatis dihapus; keduanya dipertahankan dengan peringatan untuk ditinjau.
- Kasus ambigu, parent hilang, jumlah detail invalid, atau bracket tidak dapat dipastikan menghasilkan diagnostik.
- Bracket penutup yang hilang dapat dipulihkan jika perkalian, volume, harga, dan jumlah sumber cocok; pemulihan tercatat.
- Workbook asli dan fingerprint file tidak diubah.

Audit mencakup program, kegiatan, KRO, RO, komponen, subkomponen, akun, grup “>”, subgrup “>>”, dan detail. Subtotal yang tersedia dibandingkan dengan leaf unik. Parent dan duplikasi header diperiksa menurut konteks. Subtotal sumber dipakai sebagai pembanding, bukan tambahan anggaran.

Normalisasi terhubung ke validasi input, restrukturisasi, rekap legacy, inspect batch, dan build batch. Koreksi serta peringatan muncul pada kartu inspeksi file. Rekap menolak struktur/subtotal yang tidak valid.

### Formula anak langsung

Modul baru: src/utils/budget-hierarchy.js.

Generator formula memakai parent/child dengan stack, menggantikan logika yang memasukkan “>” dan “>>” sekaligus pada akun. Berlaku untuk:

- S pada intermediate.
- S dan AM pada output SEMULA/MENJADI.
- AP dan AQ pada proses dengan FA.

Struktur campuran detail langsung + grup + subgrup tetap dihitung. Formula dibuat ulang setelah penghapusan baris kosong. Multiplier nol dipertahankan sebagai nol.

### Validator output dan ringkasan UI

Modul baru: src/utils/formula-evaluator.js. Validator src/utils/level-validator.js diperbarui.

- Evaluasi formula workbook sebenarnya tanpa bergantung pada cached result.
- Mendukung formula aplikasi berupa referensi, range, SUM, PRODUCT, ROUND, dan operasi aritmetika.
- Formula tidak didukung, siklus, nilai tidak valid, atau sheet hilang menghasilkan diagnostik.
- Audit subtotal output memakai total leaf pada cakupan setiap node, terpisah dari daftar referensi formula generator.
- Pencocokan memprioritaskan provenance dan hanya menggunakan satu input untuk satu output.
- Untuk workbook tanpa provenance, pencocokan memakai konteks lengkap dan antrean; beberapa kandidat beruraian sama dengan angka berbeda ditandai ambigu.
- Detail hilang/tambahan dan selisih positif/negatif yang saling meniadakan tetap memengaruhi status.
- MATCH hanya diberikan ketika pemeriksaan selesai dan tidak ditemukan perbedaan blocking; pemeriksaan tidak lengkap mempunyai status tersendiri.
- Kartu “Total Selisih Anggaran” mengambil selisih total program. Selisih detail bersih, jumlah subtotal berbeda, detail hilang/tambahan, dan koreksi normalisasi ditampilkan terpisah.
- Data teks workbook pada tampilan validasi di-escape.

Laporan JSON lengkap dapat diunduh melalui tautan pada hasil proses. Ringkasan header dibatasi 6.500 karakter agar tidak menyebabkan overflow HTTP. Laporan disimpan di memori maksimum 20 laporan/64 MiB total, maksimum 32 MiB per laporan, dan berlaku 10 menit. Jika kedaluwarsa atau server direstart, proses ulang untuk mendapatkan laporan baru.

Kegagalan validator/backend atau parsing laporan ditampilkan sebagai validasi belum selesai, bukan badge sesuai.

## Pengujian

Lulus:

- node test/run-recap-tests.js, juga tersedia melalui npm run test:recap.
- Suite metadata, batch, API, dan simulasi DOM frontend yang sudah ada.
- Regresi baru test/test-rkk-audit.js untuk detail/grup tiga baris, kelanjutan tanpa kode, kasus ambigu, detail identik, nol, bracket/KPPN, siklus, formula tidak didukung, subtotal salah dengan detail benar, serta selisih yang saling meniadakan.
- Pipeline FA sintetis dengan detail langsung, grup dan subgrup: AP akun 60 dan AQ akun 540, tanpa hitungan ganda.
- HTTP proses serta unduhan laporan lengkap dan batas ukuran header.
- Tampilan ringkasan anggaran besar, selisih detail terpisah, escaping, serta status belum selesai.
- Workbook (11), output lama, dan output hasil perbaikan.
- node test/test-flows.js: proses lama dengan dan tanpa FA lulus, masing-masing satu sheet/578 baris.
- Pemeriksaan sintaks modul baru/server dan git diff --check.

Lima workbook sampel lama tidak tersedia pada folder context saat pengujian ini; bagian integrasi lima sampel dilewati secara eksplisit. Fixture sintetis dan workbook (11) tetap diuji.

Pemeriksaan frontend memakai simulasi DOM, bukan browser visual. Output belum dibuka di Microsoft Excel; nilai formula diverifikasi oleh evaluator/test dan workbook berhasil disimpan serta dibaca dengan ExcelJS.

## Artefak verifikasi

- [Output normalisasi](context/verification/output-normalized.xlsx)
- [Laporan validasi lengkap](context/verification/validation-report.json)
- [Rencana implementasi](context/implementasinplan.md)

Folder context diabaikan Git. Artefak verifikasi adalah hasil lokal dan tidak menjadi prasyarat pengujian pada checkout baru.

## Penanganan kasus yang belum dapat diputuskan otomatis

Tidak ada tombol “abaikan validasi” atau penghapusan berdasarkan kesamaan nominal. Jika normalisasi tidak dapat membuktikan satu uraian, sistem menampilkan baris/alasan yang perlu ditinjau dan meminta koreksi sumber sebelum proses. UI untuk keputusan manual per kandidat belum dibuat; ini mengikuti opsi tahap awal pada bagian 11.5 rencana.

Rangkaian kandidat dibatasi 12 baris. Formula di luar grammar evaluator dilaporkan belum dapat diperiksa. Subtotal sumber yang tidak tersedia tidak diasumsikan nol. Perbedaan perkalian/pembulatan tidak disembunyikan.

Ringkasan ini menyertai rilis 3.6.0. Changelog aplikasi, CHANGELOG.md, versi package, dan label versi UI telah diselaraskan.


## Perbaikan lanjutan tampilan validasi

Halaman sekarang mengambil laporan JSON lengkap secara otomatis setelah proses selesai. Ringkasan header yang dikosongkan karena batas ukuran tidak lagi menyebabkan tabel program/detail kosong. Seluruh perbedaan detail, subtotal, koreksi normalisasi, masalah struktur, peringatan sumber, dan diagnostik tersedia langsung di halaman dalam tabel yang dapat dibuka/ditutup. Unduhan JSON tetap menjadi pelengkap.

Pemuatan mempunyai status loading, timeout 20 detik, pesan kedaluwarsa/error, dan tombol Coba lagi. Respons usang tidak menimpa laporan terbaru. Regresi frontend mereproduksi ringkasan dengan 0 rincian, lalu memastikan 2 program, 7 detail, dan 34 subtotal dari laporan penuh tampil. Error jaringan, retry, kedaluwarsa, escaping, serta respons usang turut diuji melalui simulasi DOM.
