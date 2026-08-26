BEGIN;

INSERT INTO roles(code, name) VALUES
('ADMIN','Administrator'),
('HR','Human Resources'),
('DOCTOR','Dokter'),
('NURSE','Perawat'),
('PHARMACY','Apotek'),
('FINANCE','Finance')
ON CONFLICT (code) DO NOTHING;

INSERT INTO branches(code, name, address, is_active)
VALUES ('MAIN', 'BIM CLINICS - Klinik Utama', 'Alamat klinik', TRUE)
ON CONFLICT (code) DO UPDATE SET is_active = TRUE;

INSERT INTO service_catalog(code, name, price) VALUES
('CONS-UMUM', 'Konsultasi Dokter Umum', 100000),
('ADMIN', 'Biaya Administrasi', 20000)
ON CONFLICT (code) DO NOTHING;

INSERT INTO site_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO site_facilities (title, description, sort_order)
SELECT * FROM (VALUES
  ('Ruang Tunggu Nyaman', 'Area tunggu ber-AC yang bersih dan nyaman bagi pasien dan pendamping.', 1),
  ('Ruang Periksa Pribadi', 'Ruang pemeriksaan tertutup untuk menjaga privasi setiap pasien.', 2),
  ('Apotek Terintegrasi', 'Resep dokter dapat langsung ditebus di apotek klinik tanpa berpindah lokasi.', 3),
  ('Layanan Administrasi', 'Pengurusan surat medis, rujukan, dan dokumen pendukung lainnya.', 4)
) AS v(title, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM site_facilities);

COMMIT;
