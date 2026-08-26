# BIM CLINICS — Clinic Management System

Starter sistem **BIM CLINICS** berbasis **React + Node.js/Express + TypeScript + PostgreSQL**.

## Modul awal

- Login + role-based access
- HR / master pegawai
- Dokter otomatis berasal dari pegawai bertipe `DOCTOR`
- Registrasi pasien dan kunjungan
- Rekam medis dokter
- Surat dokter -> antrean Admin -> nomor surat unik + QR verifikasi publik
- Resep dokter -> antrean Apotek
- Master obat, batch, expired date, stok FEFO
- Invoice, pembayaran, expenses
- P&L sederhana
- Absensi, cuti, payroll (schema database)
- Public doctor cards untuk landing page + upload foto dari HR

## Konsep dokter dari HR

Saat HR menambah pegawai dengan `employeeType: DOCTOR`, trigger PostgreSQL otomatis membuat `doctor_profiles`.

Contoh payload:

```json
{
  "employeeCode": "DR001",
  "fullName": "dr. Andi",
  "employeeType": "DOCTOR",
  "username": "andi",
  "password": "PasswordKuat123!",
  "roles": ["DOCTOR"],
  "specialization": "Dokter Umum",
  "sipNumber": "SIP-001",
  "showOnPublic": true
}
```

Landing page nanti tidak perlu punya master dokter sendiri. Cukup memanggil:

```http
GET /api/doctors/public
```

## Database

Buat database:

```bash
createdb bim_clinics
```

Ada dua cara menjalankan schema/migration:

**Opsi A — `npm run migrate` (disarankan, tidak perlu install `psql`)**

```bash
cp .env.example .env   # isi DATABASE_URL, lalu jalankan:
npm install
npm run migrate
```

Script ini membaca `DATABASE_URL` dari `.env` dan menjalankan semua file di folder `sql/` secara berurutan lewat koneksi Node yang sama dengan aplikasi. File yang sudah pernah dijalankan otomatis dilewati (tercatat di tabel `schema_migrations`), jadi aman dijalankan ulang kapan saja setelah menambah migration baru.

**Opsi B — `psql` (jika PostgreSQL CLI sudah terpasang di PATH)**

```bash
psql -d bim_clinics -f sql/001_schema.sql
psql -d bim_clinics -f sql/002_seed.sql
```

> Di Windows, `psql` biasanya tidak otomatis ada di PATH walau PostgreSQL sudah terinstal. Kalau muncul error `'psql' is not recognized`, pakai Opsi A di atas, atau jalankan `psql` dari folder `bin` instalasi PostgreSQL (mis. `C:\Program Files\PostgreSQL\<versi>\bin\psql.exe`).


## Backend

```bash
cp .env.example .env
npm install
npm run create-admin
npm run dev
```

Backend default: `http://localhost:3000`

Frontend/public verification default: `http://localhost:5173`

Health check:

```http
GET /health
```

## Frontend

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Menu internal awal:

- `/login`
- `/` Landing page publik
- `/dashboard` Dashboard internal
- `/registration` Registrasi pasien
- `/admin` Antrean surat dokter untuk administrasi
- `/doctor` Pemeriksaan dokter
- `/pharmacy` Resep, obat, batch dan stok
- `/finance` P&L
- `/hr` Pegawai dan dokter

## Alur utama

```text
Admin / Front Office
        |
        v
Registrasi pasien
        |
        v
      Dokter
      /    \
     /      \
  Surat     Resep
    |         |
    v         v
  Admin     Apotek
              |
              v
       Stok FEFO berkurang
              |
              v
       Invoice/Pembayaran
              |
              v
            Finance
              |
              v
             P&L

HR
 |
 +--> Pegawai
       |
       +--> employee_type = DOCTOR
             |
             +--> doctor_profiles otomatis
             +--> Modul Dokter
             +--> Jadwal Dokter
             +--> Landing Page (show_on_public = true)
```

## Catatan desain

- `employees` adalah master pegawai.
- `doctor_profiles` hanya extension data khusus dokter, bukan duplikasi pegawai.
- Dokter hanya membaca katalog obat; perubahan stok dibatasi untuk Admin/Apotek.
- Stok menggunakan `medication_batches`, sehingga expired date dan FEFO dapat dilacak.
- P&L starter bersifat cash-basis: payment sebagai revenue, stock OUT sebagai COGS, lalu dikurangi expense dan payroll.

## QR verifikasi surat dokter

Setiap surat medis memiliki:

- `document_no`, contoh `BIM-MED-20260820-000123`
- `verification_token` UUID acak
- QR yang mengarah ke `/verify/:token`
- status verifikasi berdasarkan status surat dan kunjungan

Halaman publik hanya menampilkan data yang diperlukan untuk validasi: nomor surat, nama pasien, tanggal berobat, nomor registrasi, dokter, SIP, cabang, dan masa istirahat. Diagnosis dan isi rekam medis **tidak** dipublikasikan.

Untuk database yang sudah pernah dibuat dari versi lama, jalankan:

```bash
npm run migrate
```

(atau `psql -d bim_clinics -f sql/003_bim_clinics_qr_verification.sql` jika `psql` tersedia)

Isi juga `.env` backend:

```env
PUBLIC_WEB_URL=https://domain-bim-clinics-anda.com
```

URL ini yang akan dimasukkan ke QR pada surat cetak.


## Menjalankan API + Web Sekaligus

Mulai dari versi ini, cukup jalankan dari folder utama project:

```bash
npm install
npm start
```

`npm install` di root juga akan memasang dependency frontend di folder `web`.
`npm start` menjalankan dua proses sekaligus:

- API: `http://localhost:3000`
- Landing page / web: `http://localhost:5173`

Buka `http://localhost:5173` untuk BIM CLINICS. Jangan membuka port `3000` sebagai tampilan web karena port tersebut adalah API.

Untuk menjalankan API saja gunakan `npm run dev:api`. Untuk frontend saja gunakan `npm run dev:web`.

## Windows: satu perintah untuk API + Web
Jalankan dari folder root project:

```powershell
npm install
npm start
```

`npm start` menjalankan API di `http://localhost:3000` dan Vite di `http://localhost:5173` tanpa memanggil `npm.cmd` melalui `spawn`, sehingga kompatibel dengan Windows/Node yang sebelumnya menghasilkan `spawn EINVAL`.

## Login admin
Nilai `ADMIN_USERNAME` dan `ADMIN_PASSWORD` pada `.env` adalah sumber untuk membuat/reset akun admin, tetapi akun tersebut harus dimasukkan ke PostgreSQL.

Setelah schema database sudah terpasang, jalankan dari folder root:

```bash
npm run create-admin
```

Jika berhasil akan muncul:

```text
Admin 'admin' berhasil dibuat/diupdate.
```

Setelah itu jalankan:

```bash
npm start
```

Login yang gagal sekarang menampilkan pesan error pada form dan tidak lagi me-refresh halaman login.

## Update: akses multi-cabang + dokter card/foto

Versi ini memakai aturan berikut:

- Setiap `employees` wajib memiliki `branch_id`.
- User non-ADMIN otomatis hanya membaca/menulis data cabangnya sendiri.
- ADMIN dapat melihat semua cabang dan memilih cabang saat registrasi, HR, Apotek, dan Finance.
- Tidak ada lagi `branchId: 1` yang di-hardcode dari frontend.
- ADMIN dapat menambah cabang dari menu HR.
- Dokter dibuat dari HR dan tampil sebagai card.
- Foto dokter dapat di-upload dari HR (JPG/PNG/WEBP, maksimal 5 MB).
- Dokter yang `show_on_public = true` otomatis tampil di landing page.
- Tombol Login Staff tidak ditampilkan di landing page. Halaman login tetap dapat dibuka langsung di `/login`.

Untuk database **baru**:

```bash
createdb bim_clinics
npm run migrate
```

Untuk database yang **sudah dibuat dari versi sebelumnya**, jalankan migration terbaru:

```bash
npm run migrate
```

Lalu reset/buat admin agar akun admin pasti terhubung ke cabang MAIN:

```bash
npm run create-admin
```

`create-admin` versi baru tidak lagi mengandalkan `branch_id = 1`; script mencari/membuat cabang dengan `ADMIN_BRANCH_CODE` (default `MAIN`) dan menghubungkan employee admin ke cabang tersebut.

## Riwayat Pasien
Versi ini menambahkan longitudinal medical history tanpa tabel baru. Data diambil dari `patients`, `visits`, `medical_records`, `prescriptions`, dan `prescription_items`.

- Dokter: saat memilih pasien pada antrean, riwayat langsung tampil sebelum form pemeriksaan.
- Nurse: menu **Riwayat Pasien** untuk mencari pasien via nama, NIK, atau nomor rekam medis.
- Admin: dapat melihat seluruh riwayat lintas cabang.
- Nurse/Dokter: hanya dapat membuka pasien yang memang memiliki hubungan kunjungan dengan cabang/akun mereka. Setelah akses sah, timeline menampilkan riwayat BIM CLINICS lintas cabang agar rekam medis pasien tetap longitudinal.
- Registrasi ulang dengan NIK yang sudah ada akan menggunakan `patient_id` lama, sehingga riwayat tidak terpecah.

Tidak ada migration SQL tambahan untuk fitur ini karena tabel dan index `idx_visits_patient` sudah tersedia pada schema utama.

## Kelola Konten Landing Page (judul, tentang kami, kontak)

Menu **Pengaturan** (`/settings`, hanya tampil dan bisa diakses oleh role **ADMIN**) dipakai untuk mengubah:

- Label kecil + judul + sub-judul hero
- Judul dan isi "Tentang Kami"
- Nomor telepon & alamat kontak
- Tagline footer

Landing page publik (`/`) membaca konten ini secara real-time dari `GET /api/settings/public` (tanpa login). Perubahan dari `/settings` langsung tampil begitu halaman publik di-refresh.

Untuk database baru maupun yang sudah ada, tabel `site_settings` otomatis termasuk saat menjalankan:

```bash
npm run migrate
```

Endpoint terkait:

- `GET /api/settings/public` — publik, dipakai landing page.
- `GET /api/settings` — ADMIN only, ambil nilai lengkap untuk form pengaturan.
- `PUT /api/settings` — ADMIN only, simpan perubahan.

## Fasilitas (halaman tersendiri)

Menu **Fasilitas** di navbar publik mengarah ke halaman sendiri (`/fasilitas`), bukan lagi scroll ke section di landing page. Isinya dikelola dari panel **Fasilitas** di `/settings` (ADMIN only). Setiap fasilitas dapat memiliki foto JPG/PNG/WEBP maksimal 5 MB; foto ditampilkan sebagai card bergambar di halaman publik. Fasilitas lama tanpa foto tetap tampil normal.

Database baru/lama sama-sama otomatis mendapat 4 fasilitas contoh saat menjalankan `npm run migrate` (bisa langsung diedit/dihapus dari `/settings`).

Endpoint:

- `GET /api/settings/facilities/public` — publik, hanya fasilitas aktif, terurut sesuai `sort_order`.
- `GET /api/settings/facilities` — ADMIN only, seluruh fasilitas (termasuk yang disembunyikan).
- `POST /api/settings/facilities` — ADMIN only, tambah fasilitas baru.
- `PUT /api/settings/facilities/:id` — ADMIN only, ubah judul/deskripsi/urutan.
- `POST /api/settings/facilities/:id/image` — ADMIN only, upload/ganti foto fasilitas.
- `DELETE /api/settings/facilities/:id/image` — ADMIN only, hapus foto fasilitas tanpa menghapus datanya.
- `PATCH /api/settings/facilities/:id/active` — ADMIN only, tampilkan/sembunyikan dari landing page.
- `DELETE /api/settings/facilities/:id` — ADMIN only, hapus permanen.

## Halaman Pengaturan (accordion)

`/settings` sekarang dibagi jadi beberapa panel (Beranda/Hero, Tentang Kami, Kontak & Footer, Fasilitas). Setiap panel default tertutup, hanya menampilkan ringkasan nilai saat ini — klik **Ubah** untuk memunculkan form editnya, klik lagi untuk menutup.

Bagian **Beranda (Hero)** juga punya upload foto latar (JPG/PNG/WEBP, maksimal 5 MB) yang tampil sebagai background section hero di landing page, lengkap dengan overlay gelap otomatis supaya teks tetap terbaca.

## Dashboard Ringkasan Operasional

`GET /api/dashboard/summary` (wajib login) mengembalikan angka real-time, dibatasi cabang akun (ADMIN melihat seluruh cabang):

- Jumlah kunjungan hari ini
- Jumlah kunjungan yang masih menunggu pemeriksaan dokter
- Jumlah resep yang belum diserahkan apotek
- Laba bersih hari berjalan (pendapatan dikurangi HPP dan beban operasional)

Halaman `/dashboard` menampilkan angka ini secara langsung, menggantikan tampilan placeholder sebelumnya.

## Pengamanan API

Beberapa lapisan keamanan tambahan sudah dipasang di `src/app.ts`:

- **Helmet** — menambahkan security header standar (mis. `X-Content-Type-Options`, `Strict-Transport-Security`).
- **CORS whitelist** — hanya berlaku ketat saat `NODE_ENV=production`: origin harus terdaftar di env `CORS_ORIGIN` (pisahkan koma untuk multi-domain). Saat development (`NODE_ENV` kosong/`development`), origin apa pun diizinkan supaya tidak terhambat oleh localhost vs 127.0.0.1 vs IP jaringan lokal. **Set `NODE_ENV=production` dan isi `CORS_ORIGIN` dengan domain produksi asli saat deploy.**
- **Rate limiting**:
  - `POST /api/auth/login` dibatasi 10 percobaan / 15 menit per IP untuk memperlambat brute-force password.
  - `GET /api/verification/*` (halaman verifikasi QR publik) dibatasi 60 permintaan / 15 menit per IP supaya token tidak bisa di-scan besar-besaran.
  - Seluruh `/api/*` juga punya batas umum 300 permintaan / menit per IP sebagai pagar terluar.

Checklist tambahan yang perlu dilakukan manual sebelum production:

- Set `JWT_SECRET` dengan random string panjang (≥32 byte), jangan pernah commit `.env` ke git.
- Pastikan koneksi PostgreSQL produksi memakai SSL (`DATABASE_URL` dengan `sslmode=require` atau setara).
- Jalankan API di belakang HTTPS (reverse proxy / load balancer), karena token JWT dikirim lewat header `Authorization`.
- Pertimbangkan menambahkan audit log untuk akses rekam medis pasien (siapa membuka data pasien mana, kapan) jika dibutuhkan untuk kepatuhan data kesehatan.

## Penyimpanan foto lokal

Foto dokter, foto hero, dan foto fasilitas **disimpan sebagai file lokal di server**, bukan di PostgreSQL dan bukan di cloud storage. Database hanya menyimpan URL relatif file.

Default folder:

```text
./uploads/
  doctors/
  site/
  facilities/
```

Konfigurasi backend:

```env
UPLOAD_DIR=uploads
```

Untuk production disarankan memakai path persisten di luar folder release/repository, misalnya:

```env
UPLOAD_DIR=/var/lib/bim-clinics/uploads
```

API tetap menyajikan file melalui URL `/uploads/...`, jadi frontend tidak perlu mengetahui lokasi fisik folder server. Saat foto dokter, hero, atau fasilitas diganti, file lokal lama otomatis dibersihkan setelah database berhasil diperbarui. Saat fasilitas dihapus, file fotonya juga ikut dibersihkan. Upload divalidasi sebagai JPG/PNG/WEBP dan maksimal 5 MB.

Folder `uploads` masuk `.gitignore` agar foto runtime/pasien/pegawai tidak ikut masuk Git. Hanya `uploads/.gitkeep` yang disimpan agar struktur folder tersedia setelah clone.

> Penting saat deploy dengan Docker/Coolify: mount `UPLOAD_DIR` sebagai persistent volume. Tanpa volume persisten, foto lokal akan hilang saat container dibuat ulang.

## Setup cepat dari clone baru

```bash
git clone <repo-anda>
cd <folder-project>
cp .env.example .env
cp web/.env.example web/.env
npm install
npm run setup
npm start
```

`npm run setup` menjalankan seluruh migration database lalu membuat/update akun admin dari `.env`.

Sebelum push atau deploy, cek build dengan:

```bash
npm run check
```

Snapshot database final juga tersedia di:

```text
database/schema.sql
database/seed.sql
database/README.md
```
#   P O R T O F O L I O - C L I N I C S  
 