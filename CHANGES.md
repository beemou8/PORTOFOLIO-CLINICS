# Perubahan paket ini

## Update foto fasilitas

- Menambahkan foto untuk setiap Fasilitas: upload saat tambah, ganti/hapus saat edit, dan tampil di halaman publik `/fasilitas`.
- Foto fasilitas disimpan lokal di `UPLOAD_DIR/facilities` dan database hanya menyimpan `image_url`.
- Menambahkan migration `sql/008_facility_image.sql` untuk database yang sudah pernah menjalankan migration fasilitas sebelumnya.
- Saat fasilitas dihapus, file foto lokalnya ikut dibersihkan otomatis.

## Update sebelumnya

- Penyimpanan foto dokter dipusatkan ke local filesystem melalui `src/lib/localUploads.ts`.
- Penyimpanan foto hero memakai helper local filesystem yang sama.
- Lokasi fisik foto dapat diatur dengan `UPLOAD_DIR`; default `./uploads`.
- Database hanya menyimpan URL relatif `/uploads/...`, bukan base64/BYTEA.
- File foto lama otomatis dihapus setelah foto pengganti berhasil disimpan ke database.
- Validasi signature file JPG/PNG/WEBP + batas ukuran 5 MB.
- `/uploads` disajikan langsung oleh Express dan dapat digunakan frontend yang berbeda origin saat development.
- Folder upload dibuat otomatis saat API start.
- Menambahkan `.gitignore` yang aman untuk `.env`, dependency, build output, dan foto runtime.
- Menambahkan `database/schema.sql`, `database/seed.sql`, dan dokumentasi database.
- Menambahkan `DEPLOY.md` untuk setup, persistent volume, dan git push.
- Menambahkan script `npm run setup` dan `npm run check`.

Validasi yang dilakukan di lingkungan pengerjaan:

- Parse syntax seluruh file TypeScript/TSX: 40 file, 0 syntax error.
- Tes tulis dan hapus file melalui helper local upload: berhasil.
- `git diff --check`: tidak ada whitespace error pada staged source.
- Isi runtime `uploads/` terkonfirmasi di-ignore Git.

Full dependency build tidak dijalankan sampai selesai di sandbox karena instalasi package registry tertahan; jalankan `npm install && npm run check` pada mesin/server yang memiliki akses registry npm sebelum deploy.
