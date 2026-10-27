# Rencana perbaikan performa Rekap Hirarki Satker

Tanggal analisis: 27 Oktober 2026. Baseline aplikasi: 3.9.0, Node.js v24.15.0, ExcelJS 4.4.0. Status seluruh pekerjaan di bawah: **direncanakan, belum diimplementasikan**. Rilis 3.9.0 menambahkan outline dan menyeragamkan warna Excel; rilis ini tidak mengubah performa upload, inspect, batch atau filter.

## Tujuan dan batas perubahan

Percepat dua alur: upload/pemeriksaan file dan tombol Buat Rekap Gabungan. Pertahankan validasi hierarki/duplikasi, normalisasi, rekonsiliasi subtotal, ketepatan total/sumber dana/blokir, atribusi sumber, konfirmasi pemilik dan penolakan lintas tahun. Kecepatan tidak boleh diperoleh dengan melewati pemeriksaan data yang wajib.

## Alur saat ini

1. Browser memeriksa ekstensi, jumlah dan ukuran, lalu mengunggah semua file terpilih ke `/api/recap-hierarchy/inspect`.
2. `inspectFiles` memproses sumber secara berurutan. `inspectSource` memanggil `loadSource` untuk membaca workbook dan metadata, kemudian `validateInput` yang membaca workbook lagi melalui `parseInput`. Validator dan parser membuat worksheet normalisasi masing-masing. Parser canonical membentuk node dan rincian; sistem memeriksa konteks, struktur serta rekonsiliasi subtotal. Hasil inspect hanya mengirim metadata, bukan sumber canonical untuk dipakai ulang.
3. Menambah atau menghapus satu file memanggil `inspectSelected` dan memeriksa ulang seluruh daftar.
4. Klik Buat Rekap Gabungan mengunggah semua file lagi bersama manifest. `buildBatch` memvalidasi manifest/hash dan mengulang `inspectSource` untuk semua sumber sebelum menerapkan pemilik/PJ, filter dan agregasi.
5. `packRecap` memadatkan rincian, kemudian backend melakukan JSON serialization dan menolak respons di atas 4 MiB. Browser mengembangkan referensi rincian dan merender hasil.
6. Perubahan filter pemilik/PJ juga mengunggah dan memeriksa ulang seluruh sumber. Filter akun/sumber dana/blokir dan pencarian berjalan di browser.
7. `applyBatchRecap` membangun tabel akun walaupun tab awal adalah pohon; `initTreeRecapView` dan `switchRecapViewMode('tree')` sama-sama merender pohon. Baris cabang tertutup tetap dibuat di DOM lalu diberi `display:none`.
8. AbortController membatalkan penantian browser, belum membatalkan pekerjaan backend. Deadline 60 detik diperiksa di beberapa titik, bukan penghentian langsung; inspect tidak memeriksanya lagi setelah sumber terakhir, batch memeriksanya sebelum proyeksi/agregasi.

Sumber kode: [recap-batch.js](public/recap-batch.js), [hierarchy-recap-batch.js](src/utils/hierarchy-recap-batch.js), [rkk-metadata.js](src/utils/rkk-metadata.js), [validator](src/steps/00-validate-input.js), [parse-input](src/steps/01-parse-input.js), [normalizer](src/utils/rkk-detail-normalizer.js), [parser/aggregator](src/utils/hierarchy-recap.js), [frontend](public/index.html), [API](server.js).

## Hasil pengukuran lokal

Sampel: `context/RINCIAN KERTAS KERJA SATKER (11).xlsx`, 217.700 byte (sekitar 213 KiB), satu sheet, 2.888 baris fisik, 1.665 rincian, 195 summary node dan total Rp117.302.994.000. XML worksheet berukuran 2.349.176 byte dengan 37.592 sel dan **7.682 rentang merge**. File context dan skrip eksperimen scratch adalah artefak lokal yang diabaikan Git, bukan prasyarat aplikasi.

Pengukuran memanggil fungsi backend langsung, memisahkan `packRecap`/serialization dari `buildBatch`. Satu sumber diulang lima kali; median di bawah memakai empat run setelah eksekusi pertama. Skala tiga/lima sumber diulang tiga kali menggunakan salinan struktur workbook yang sama, ZIP comment berbeda agar hash berbeda, dan pemilik berbeda. Ini simulasi beban seukuran sampel, bukan tiga/lima workbook Satker independen.

| Beban | Median inspect | Median buildBatch | JSON hasil | Dapat dikirim oleh batas API sekarang |
| --- | ---: | ---: | ---: | --- |
| 1 file | 5,815 detik | 5,879 detik | 2.038.951 byte / 1,94 MiB | Ya |
| 3 file simulasi | 17,390 detik | 19,661 detik | 6.074.179 byte / 5,79 MiB | Tidak, melebihi 4 MiB |
| 5 file simulasi | 30,164 detik | 31,111 detik | 10.109.705 byte / 9,64 MiB | Tidak, melebihi 4 MiB |

Pada satu file, dua pemanggilan pembacaan XLSX menghabiskan sekitar 5,5–5,9 detik atau 95–96% waktu backend. Jalur parser canonical sekitar 0,10–0,12 detik, agregasi ringkasan sekitar 25–30 ms, pack dan JSON serialization sekitar 10–15 ms. Pengukuran tahap bersifat inklusif dan dapat saling mencakup; jangan menjumlahkan semuanya sebagai tahap eksklusif.

Pengujian HTTP localhost tiga kali: inspect 6,383–6,900 detik dan batch 6,457–7,070 detik sampai body diterima; JSON parsing batch sekitar 4–5 ms. Respons inspect 5.712 byte. Angka tidak mencakup jaringan internet, startup deployment, konfirmasi user, atau render/layout/paint browser. Bukan SLA produksi.

Eksperimen terisolasi memakai `ignoreNodes: ['mergeCells']` pada pembacaan XLSX menghasilkan inspect **385 ms** dan batch **424 ms**, dibanding **6.531 ms** dan **6.257 ms** pada run normal pembanding. Deep comparison seluruh hasil inspect serta respons batch yang sudah dipadatkan identik; jumlah rincian dan total tidak berubah. Ini satu pasangan run pada satu sampel, belum pembuktian kompatibilitas seluruh format RKK. Kode eksperimen tidak dipasang ke aplikasi.

Eksperimen memakai ulang sumber canonical yang sudah diperiksa menghasilkan proyeksi/agregasi satu sumber sekitar **18–44 ms** pada lima run, tanpa pembacaan XLSX. Angka ini belum termasuk pencarian cache, pack, JSON, jaringan atau frontend; bukan target waktu keseluruhan endpoint.

## Urutan implementasi

### P0 — Instrumentasi dan baseline yang dapat diulang

- [ ] Tambahkan alat benchmark terpisah dari tes kebenaran, memakai sampel yang tersedia dan identitas sumber/pemilik sah. Laporkan sampel yang tidak tersedia secara eksplisit.
- [ ] Ukur waktu penerimaan upload, baca XLSX, metadata, normalisasi, validasi, parser, proyeksi, agregasi, pack dan serialization. Pisahkan waktu inklusif/eksklusif, run pertama, median, p95, ukuran payload, pemakaian memori dan jumlah pembacaan workbook.
- [ ] Ukur `performance`/Resource Timing di browser sampai hasil terlihat; pisahkan transfer, JSON parsing, hydration, pembuatan DOM dan layout/paint. Uji tab struktur dan akun, termasuk perangkat lambat.
- [ ] Ulangi beban 1/3/5/10 sumber bila ukuran/sampel memungkinkan, serta beberapa user bersamaan. Jangan menyatakan uji simulasi sebagai data Satker independen.

### P1 — Optimasi merge pada jalur rekap

- [ ] Evaluasi pembacaan tanpa pembangunan merge untuk sumber rekap saja. ExcelJS yang terpasang memeriksa setiap merge terhadap merge sebelumnya, sehingga banyak merge menjadi kandidat penyebab biaya besar. Jangan mengganti loader RAB/FA secara global.
- [ ] Uji apakah nilai master dan konteks tetap terbaca saat merge dilewati, khususnya merge vertikal/lintas kolom yang memengaruhi kode, uraian, tahun, satker, volume, jumlah atau sumber dana.
- [ ] Bandingkan metadata/evidence, validasi, temuan normalisasi, struktur/reconciliation, rincian dan seluruh respons rekap dengan jalur lama. Tangani format yang membutuhkan merge melalui pembacaan/normalisasi yang kompatibel atau fallback eksplisit.
- [ ] Uji file invalid/rusak dan merge tidak lazim; perubahan loader tidak boleh membuat sumber yang sebelumnya ditolak lolos tanpa alasan yang terdokumentasi.
- [ ] Ukur ulang pada sampel yang sama. Hasil 385/424 ms adalah bukti eksperimen, bukan janji ambang performa seluruh workbook.

### P2 — Satu pembacaan dan konteks pemeriksaan per sumber

- [ ] Bentuk konteks pemeriksaan berisi identitas/hash, worksheet yang sudah disiapkan, metadata, audit dan data canonical.
- [ ] Beri validator jalur menerima konteks/worksheet yang sudah dibaca; pertahankan API buffer untuk pemanggil lama.
- [ ] Satukan normalisasi yang kompatibel tanpa mengubah semantik unmerge/pembersihan nilai/formula pada `parseInput`. Jangan sekadar meneruskan worksheet mentah ke validator.
- [ ] Pastikan satu sumber dibaca sekali dan hasil audit tidak dihitung ulang secara tidak perlu. Cache audit sekarang melekat pada objek worksheet; objek baru tidak berbagi hasil tersebut.
- [ ] Jalankan regresi rekap dan pemanggil validator lama/RAB/FA bila helper bersama berubah.

### P3 — Pemakaian ulang hasil inspect pada batch dan filter

- [ ] Rancang penyimpanan sementara sumber canonical yang sudah lolos, terikat sesi dan memiliki TTL, batas memori/jumlah sumber, eviction dan versi parser/validasi.
- [ ] Gunakan referensi/token server yang terverifikasi. Hash dari browser saja tidak membuktikan bahwa sumber sudah diperiksa atau boleh diakses oleh sesi tersebut.
- [ ] Batch memakai ulang sumber sah tetapi tetap memvalidasi manifest, pemilik/konfirmasi, tahun, mapping PJ, filter, duplikasi dan kecocokan isi sumber.
- [ ] Perubahan pemilik/PJ/tahun memicu validasi manifest dan proyeksi ulang sesuai kebutuhan; perubahan file/hash atau versi parser membatalkan hasil pemeriksaan lama.
- [ ] Tetapkan perilaku cache miss/kedaluwarsa: fallback upload/pemeriksaan atau pesan pemulihan yang jelas. Pada deployment multi-instance/serverless, cache proses hanya boleh menjadi optimasi opsional; penghilangan upload membutuhkan penyimpanan sementara yang tersedia lintas request/instance.
- [ ] Tambahkan pemeriksaan hanya untuk file baru/berubah. Hapus file tidak memeriksa ulang file lain. Pertahankan metadata, pilihan dan konfirmasi sumber yang masih sah.
- [ ] Filter pemilik/PJ memakai sumber canonical tersimpan; jangan menghapus aturan penolakan lintas tahun atau validasi semua sumber sebelum filter.
- [ ] Lindungi objek canonical dari mutasi proyeksi/filter agar penggunaan ulang tidak mencampur data request berikutnya.

### P4 — Payload dan waktu render frontend

- [ ] Evaluasi duplikasi `rootSummary`, `nodeSummaries`, `nodesByLevel` dan `hierarchyTree`; rincian sudah dipadatkan melalui `detailRecords`/`detailIndexes`, jadi jangan menghitungnya sebagai rincian penuh yang belum dipadatkan.
- [ ] Pertimbangkan respons ringkasan awal dan pengambilan rincian sesuai kebutuhan, dengan kontrak/schema yang kompatibel dan dukungan ekspor. Menaikkan batas 4 MiB saja bukan penyelesaian beban komputasi/transfer/memori.
- [ ] Render hanya tab aktif dan hilangkan render pohon kedua saat hasil pertama diterapkan.
- [ ] Bangun baris cabang yang terlihat; bila volume besar, pertimbangkan pagination/virtualisasi. Lazy render tidak boleh membatasi ekspor atau pencarian.
- [ ] Verifikasi state fokus, buka/tutup, filter, ekspor, hasil kosong dan reset setelah render ditunda.

### P5 — Pembatalan, deadline dan kapasitas

- [ ] Teruskan pembatalan request ke pekerjaan backend dan periksa sinyal/deadline di antara tahap serta sumber. Operasi CPU sinkron panjang memerlukan strategi penghentian yang sesuai.
- [ ] Terapkan pemeriksaan deadline setelah sumber terakhir dan tahap proyeksi/agregasi; bedakan timeout dari error validasi/file dan tampilkan pesan pemulihan.
- [ ] Ukur kebutuhan worker thread dengan concurrency terbatas bila CPU masih dominan setelah P1–P3. Jangan menganggap `Promise.all` otomatis mempercepat parsing CPU atau melindungi event loop; batasi memori workbook dan beban serentak.
- [ ] Tampilkan progres tahap/file agar pengguna memahami pekerjaan yang masih berjalan. Progres meningkatkan kejelasan, bukan mengurangi waktu komputasi dengan sendirinya.

## Kriteria selesai dan verifikasi

- [ ] Hasil sumber sah tetap sama: records, total/dana/blokir, target, identitas/atribusi, hierarki, temuan dan rekonsiliasi; ekspor formula/outline tetap benar.
- [ ] Sumber invalid, duplikat/revisi, tahun berbeda, pemilik belum dikonfirmasi, mapping tidak sah dan manifest/hash tidak cocok tetap ditolak.
- [ ] Bukti benchmark sebelum/sesudah disimpan dengan lingkungan, sampel, jumlah run, median/p95, payload/memori dan batas pengukuran. Setiap perubahan menunjukkan tahap yang dipercepat, bukan hanya satu angka total.
- [ ] P2 menunjukkan satu pembacaan XLSX per sumber pada cache miss; P3 menunjukkan tidak ada pembacaan ulang saat referensi inspect masih sah.
- [ ] Uji cache hit/miss/expiry/eviction, isolasi sesi, cold instance, pergantian sumber, request bersamaan dan pembatalan tanpa hasil usang.
- [ ] Kasus melebihi 4 MiB punya penanganan yang jelas; jangan menyatakan seluruh batch 10 file akan berhasil tanpa menguji ukuran hasil.
- [ ] `npm run test:recap`, tes RAB/FA bila terdampak, pemeriksaan browser yang relevan dan `git diff --check` dijalankan. Catat sampel/pemeriksaan yang dilewati.
- [ ] Perbarui README, PRD, Architecture, Schema, Design dan changelog ketika setiap tahap benar-benar diimplementasikan. Hasil eksperimen tidak boleh ditulis sebagai fitur yang sudah dirilis.

## Tindak lanjut terpisah

- Pemetaan format RKK dengan volume L/harga N/jumlah Q belum didukung; optimasi performa tidak otomatis menambah dukungan format tersebut.
- Audit visual output XLSX di Microsoft Excel tetap diperlukan; tes serialisasi tidak membuktikan interaksi outline atau hasil cetak.
- Pembanding lama audit RKK bersifat opsional; ketiadaannya harus dilaporkan sebagai skip tanpa menutupi kegagalan assertion saat file tersedia.
