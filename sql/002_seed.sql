INSERT INTO branches(code, name, address)
VALUES ('MAIN', 'BIM CLINICS - Klinik Utama', 'Alamat klinik')
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_catalog(code, name, price) VALUES
('CONS-UMUM', 'Konsultasi Dokter Umum', 100000),
('ADMIN', 'Biaya Administrasi', 20000)
ON CONFLICT (code) DO NOTHING;
