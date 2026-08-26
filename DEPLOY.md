# Deploy / Git Push BIM CLINICS

## 1. Siapkan environment

```bash
cp .env.example .env
cp web/.env.example web/.env
```

Isi minimal:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/bim_clinics
JWT_SECRET=GANTI_RANDOM_SECRET_MINIMAL_32_BYTE
PUBLIC_WEB_URL=https://domain-anda
CORS_ORIGIN=https://domain-anda
NODE_ENV=production
UPLOAD_DIR=/var/lib/bim-clinics/uploads
```

Frontend:

```env
VITE_API_URL=https://domain-api-anda/api
```

Jika web dan API berada di domain yang sama melalui reverse proxy, `VITE_API_URL` dapat diarahkan ke URL API pada domain tersebut.

## 2. Database

Cara yang direkomendasikan:

```bash
npm install
npm run setup
```

`npm run setup` = migration SQL + create/update admin.

Untuk instalasi manual PostgreSQL baru tersedia snapshot:

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
npm run create-admin
```

## 3. Foto lokal / persistent volume

File foto runtime berada di `UPLOAD_DIR`. Folder ini sengaja tidak masuk Git. Database hanya menyimpan URL `/uploads/...`.

Jika memakai Docker/Coolify, buat persistent volume, contoh:

```text
Host / volume: bim-clinics-uploads
Container path: /var/lib/bim-clinics/uploads
```

Lalu set:

```env
UPLOAD_DIR=/var/lib/bim-clinics/uploads
```

Jangan menaruh foto runtime hanya di filesystem ephemeral container.

## 4. Cek sebelum push

```bash
npm run check
git status
git diff --check
```

File `.env`, `node_modules`, hasil build, dan isi `uploads/` sudah dikecualikan oleh `.gitignore`.

## 5. Git push

Untuk repository baru:

```bash
git init
git add .
git commit -m "Prepare BIM CLINICS with local photo storage"
git branch -M main
git remote add origin <URL-REPOSITORY>
git push -u origin main
```

Untuk repository yang sudah ada, cukup copy perubahan project ini ke working tree repository Anda lalu:

```bash
git add .
git commit -m "Use persistent local photo storage and add database schema"
git push
```
