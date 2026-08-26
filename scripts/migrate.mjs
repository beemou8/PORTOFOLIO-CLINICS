// Menjalankan file SQL di folder sql/ secara berurutan lewat koneksi pg yang sama
// dengan aplikasi (DATABASE_URL di .env), supaya tidak perlu psql terpasang di PATH.
// Sudah pernah dijalankan -> dilewati (dicatat di tabel schema_migrations).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.resolve(__dirname, '..', 'sql');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL belum diisi di .env. Salin dari .env.example lalu sesuaikan.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = fs.readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set((await pool.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename));

  let ranAny = false;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`- ${file} (sudah pernah dijalankan, dilewati)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
    console.log(`> Menjalankan ${file} ...`);
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [file]);
      console.log(`  selesai.`);
      ranAny = true;
    } catch (err) {
      console.error(`  gagal menjalankan ${file}:`, err.message);
      await pool.end();
      process.exit(1);
    }
  }

  if (!ranAny) console.log('Tidak ada migration baru. Database sudah mutakhir.');
  else console.log('Semua migration selesai dijalankan.');

  await pool.end();
}

main();
