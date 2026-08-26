BEGIN;

-- Konten landing page yang dapat diatur ADMIN (judul, tentang kami, kontak, dll).
-- Didesain sebagai single-row config table (id selalu 1) supaya sederhana untuk dibaca publik.
CREATE TABLE IF NOT EXISTS site_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_eyebrow VARCHAR(80) NOT NULL DEFAULT 'BIM CLINICS',
  hero_title VARCHAR(200) NOT NULL DEFAULT 'Pelayanan kesehatan yang dekat, jelas, dan terpercaya.',
  hero_subtitle TEXT NOT NULL DEFAULT 'Konsultasi dokter, layanan apotek, serta dokumen medis yang dapat diverifikasi secara digital.',
  about_title VARCHAR(150) NOT NULL DEFAULT 'Tentang Kami',
  about_content TEXT NOT NULL DEFAULT 'BIM CLINICS adalah klinik yang berkomitmen memberikan pelayanan kesehatan yang cepat, jelas, dan dapat dipercaya bagi masyarakat.',
  contact_phone VARCHAR(30) NOT NULL DEFAULT '+620000000000',
  contact_address TEXT,
  footer_tagline VARCHAR(200) NOT NULL DEFAULT 'Pelayanan kesehatan terintegrasi.',
  updated_by BIGINT REFERENCES employees(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMIT;
