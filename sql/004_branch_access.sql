BEGIN;

-- Pastikan selalu ada cabang utama sebelum akun/pegawai dibuat.
INSERT INTO branches(code, name, address, is_active)
VALUES ('MAIN', 'BIM CLINICS - Klinik Utama', 'Alamat klinik', TRUE)
ON CONFLICT (code) DO UPDATE SET is_active = TRUE;

-- Hilangkan default branch lama jika database pernah dibuat dari versi awal.
ALTER TABLE employees ALTER COLUMN branch_id DROP DEFAULT;

-- Pegawai lama yang belum punya cabang dipindahkan ke MAIN.
UPDATE employees
SET branch_id = (SELECT id FROM branches WHERE code = 'MAIN')
WHERE branch_id IS NULL;

ALTER TABLE employees ALTER COLUMN branch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_visits_branch ON visits(branch_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_branch ON prescriptions(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);

COMMIT;
