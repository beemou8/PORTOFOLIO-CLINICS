# Database BIM CLINICS

Untuk penggunaan normal aplikasi, gunakan migration di folder `sql/`:

```bash
npm run migrate
npm run create-admin
```

Folder ini menyediakan snapshot schema final untuk instalasi PostgreSQL baru atau dokumentasi database:

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
```

- `schema.sql`: struktur tabel, constraint, index, trigger, view, dan extension.
- `seed.sql`: role dasar, cabang MAIN, service awal, site settings, dan fasilitas awal.
- Foto **tidak disimpan sebagai BYTEA/base64 di PostgreSQL**. Database hanya menyimpan URL relatif seperti `/uploads/doctors/...jpg` dan `/uploads/site/...webp`; file asli berada di local filesystem sesuai `UPLOAD_DIR`.
