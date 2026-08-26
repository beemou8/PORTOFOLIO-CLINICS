BEGIN;

-- Daftar fasilitas klinik yang tampil di section "Fasilitas" landing page.
CREATE TABLE IF NOT EXISTS site_facilities (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_facilities_order ON site_facilities(sort_order);

-- Seed contoh fasilitas umum klinik, hanya jika tabel masih kosong.
INSERT INTO site_facilities (title, description, sort_order)
SELECT * FROM (VALUES
  ('Ruang Tunggu Nyaman', 'Area tunggu ber-AC yang bersih dan nyaman bagi pasien dan pendamping.', 1),
  ('Ruang Periksa Pribadi', 'Ruang pemeriksaan tertutup untuk menjaga privasi setiap pasien.', 2),
  ('Apotek Terintegrasi', 'Resep dokter dapat langsung ditebus di apotek klinik tanpa berpindah lokasi.', 3),
  ('Layanan Administrasi', 'Pengurusan surat medis, rujukan, dan dokumen pendukung lainnya.', 4)
) AS v(title, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM site_facilities);

COMMIT;
