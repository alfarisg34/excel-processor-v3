# Aturan kerja proyek

## Wajib sebelum setiap `git push`

1. Tinjau seluruh perubahan dan commit yang akan dikirim, termasuk perubahan dari tugas sebelumnya.
2. Perbarui `CHANGELOG.md` untuk mencatat perubahan tersebut secara jelas. Gunakan bagian `Unreleased` jika versi rilis belum ditentukan; jangan mencatat ulang perubahan yang sudah terdokumentasi.
3. Tinjau dokumen yang ada dan perbarui semua dokumen yang terdampak agar sesuai dengan implementasi terbaru: `README.md`, `PRD.md`, `Architecture.md`, `Schema.md`, `Design.md`, `AGENTS.md`, serta dokumen lain yang relevan. Jangan mengubah dokumen yang tidak terdampak hanya untuk mengganti tanggal.
4. Saat menyiapkan rilis, selaraskan changelog aplikasi di `src/utils/changelog.js` dengan `CHANGELOG.md`. Jika versi dinaikkan, selaraskan juga `package.json`, `package-lock.json`, dan label versi UI.
5. Pastikan catatan pengujian sesuai dengan pemeriksaan yang benar-benar dilakukan; sebutkan pemeriksaan yang dilewati atau keterbatasan yang masih ada.
6. Jalankan pemeriksaan yang sesuai dengan perubahan serta `git diff --check`. Sertakan pembaruan changelog dan dokumentasi dalam commit yang dikirim.
7. Jangan menjalankan `git push` sebelum langkah di atas selesai. Jika ada hambatan, jelaskan hambatannya dan selesaikan terlebih dahulu.

Aturan ini berlaku untuk setiap push, termasuk perbaikan kecil, perubahan tampilan, konfigurasi, dan dokumentasi. Aturan ini tidak memberikan izin otomatis untuk melakukan commit atau push; ikuti instruksi pengguna dalam sesi.
