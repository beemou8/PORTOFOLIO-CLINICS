-- BIM CLINICS canonical schema for a fresh PostgreSQL database.
-- For normal app setup, `npm run migrate` remains the recommended path.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SEQUENCE IF NOT EXISTS medical_document_no_seq START WITH 1;

CREATE TABLE IF NOT EXISTS branches (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  address TEXT,
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  employee_code VARCHAR(30) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  employee_type VARCHAR(30) NOT NULL CHECK (employee_type IN ('DOCTOR','PHARMACY','ADMIN','FINANCE','HR','NURSE','OTHER')),
  phone VARCHAR(30),
  email VARCHAR(150),
  hire_date DATE,
  termination_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_accounts (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT UNIQUE NOT NULL REFERENCES employees(id),
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS doctor_profiles (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  specialization VARCHAR(120),
  sip_number VARCHAR(120),
  biography TEXT,
  photo_url TEXT,
  show_on_public BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION sync_doctor_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_type = 'DOCTOR' THEN
    INSERT INTO doctor_profiles(employee_id, is_active)
    VALUES (NEW.id, NEW.is_active)
    ON CONFLICT (employee_id) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = NOW();
  ELSIF TG_OP = 'UPDATE' AND OLD.employee_type = 'DOCTOR' AND NEW.employee_type <> 'DOCTOR' THEN
    UPDATE doctor_profiles SET is_active = FALSE, show_on_public = FALSE, updated_at = NOW()
    WHERE employee_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_doctor_profile ON employees;
CREATE TRIGGER trg_sync_doctor_profile
AFTER INSERT OR UPDATE OF employee_type, is_active ON employees
FOR EACH ROW EXECUTE FUNCTION sync_doctor_profile();

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id BIGSERIAL PRIMARY KEY,
  doctor_id BIGINT NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS patients (
  id BIGSERIAL PRIMARY KEY,
  medical_record_no VARCHAR(40) UNIQUE NOT NULL,
  nik VARCHAR(30) UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  birth_date DATE,
  gender CHAR(1) CHECK (gender IN ('M','F')),
  phone VARCHAR(30),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visits (
  id BIGSERIAL PRIMARY KEY,
  registration_no VARCHAR(50) UNIQUE NOT NULL,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  patient_id BIGINT NOT NULL REFERENCES patients(id),
  doctor_id BIGINT REFERENCES doctor_profiles(id),
  complaint TEXT,
  status VARCHAR(30) NOT NULL CHECK (status IN ('REGISTERED','WAITING_DOCTOR','IN_DOCTOR','WAITING_PHARMACY','WAITING_PAYMENT','COMPLETED','CANCELLED')),
  registered_by BIGINT REFERENCES employees(id),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_date ON visits(doctor_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);

CREATE TABLE IF NOT EXISTS medical_records (
  id BIGSERIAL PRIMARY KEY,
  visit_id BIGINT UNIQUE NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  doctor_id BIGINT NOT NULL REFERENCES doctor_profiles(id),
  anamnesis TEXT,
  diagnosis TEXT NOT NULL,
  treatment_notes TEXT,
  systolic INTEGER,
  diastolic INTEGER,
  temperature NUMERIC(4,1),
  weight_kg NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_documents (
  id BIGSERIAL PRIMARY KEY,
  document_no VARCHAR(60) UNIQUE NOT NULL DEFAULT (
    'BIM-MED-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('medical_document_no_seq')::text, 6, '0')
  ),
  verification_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  verification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  visit_id BIGINT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  doctor_id BIGINT NOT NULL REFERENCES doctor_profiles(id),
  document_type VARCHAR(40) NOT NULL CHECK (document_type IN ('SICK_LETTER','REFERRAL','MEDICAL_CERTIFICATE','OTHER')),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  rest_start_date DATE,
  rest_end_date DATE,
  destination VARCHAR(30) NOT NULL DEFAULT 'ADMIN',
  status VARCHAR(30) NOT NULL DEFAULT 'WAITING_ADMIN' CHECK (status IN ('WAITING_ADMIN','PROCESSED','PRINTED','CANCELLED')),
  processed_by BIGINT REFERENCES employees(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (rest_end_date IS NULL OR rest_start_date IS NULL OR rest_end_date >= rest_start_date)
);

CREATE INDEX IF NOT EXISTS idx_medical_documents_verification_token
  ON medical_documents(verification_token);

CREATE TABLE IF NOT EXISTS medications (
  id BIGSERIAL PRIMARY KEY,
  sku VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  generic_name VARCHAR(180),
  unit VARCHAR(40) NOT NULL,
  sell_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medication_batches (
  id BIGSERIAL PRIMARY KEY,
  medication_id BIGINT NOT NULL REFERENCES medications(id),
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  batch_no VARCHAR(80) NOT NULL,
  expiry_date DATE NOT NULL,
  purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_stock NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (medication_id, branch_id, batch_no)
);

CREATE INDEX IF NOT EXISTS idx_batch_fefo ON medication_batches(branch_id, medication_id, expiry_date) WHERE current_stock > 0;

CREATE TABLE IF NOT EXISTS prescriptions (
  id BIGSERIAL PRIMARY KEY,
  visit_id BIGINT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  doctor_id BIGINT NOT NULL REFERENCES doctor_profiles(id),
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  status VARCHAR(30) NOT NULL CHECK (status IN ('DRAFT','SUBMITTED','PREPARING','DISPENSED','CANCELLED')),
  notes TEXT,
  dispensed_by BIGINT REFERENCES employees(id),
  dispensed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id BIGSERIAL PRIMARY KEY,
  prescription_id BIGINT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medication_id BIGINT NOT NULL REFERENCES medications(id),
  qty NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration_days INTEGER,
  instruction TEXT
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES medication_batches(id),
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('IN','OUT','ADJUSTMENT_PLUS','ADJUSTMENT_MINUS','RETURN')),
  qty NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  reference_type VARCHAR(40),
  reference_id BIGINT,
  notes TEXT,
  created_by BIGINT REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_catalog (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  price NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_no VARCHAR(50) UNIQUE NOT NULL,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  visit_id BIGINT REFERENCES visits(id),
  patient_id BIGINT NOT NULL REFERENCES patients(id),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL CHECK (status IN ('UNPAID','PARTIAL','PAID','VOID')),
  created_by BIGINT REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('SERVICE','MEDICATION','OTHER')),
  reference_id BIGINT,
  description VARCHAR(250) NOT NULL,
  qty NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(30) NOT NULL CHECK (method IN ('CASH','TRANSFER','QRIS','CARD','INSURANCE','OTHER')),
  received_by BIGINT REFERENCES employees(id),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id),
  category VARCHAR(100) NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL,
  created_by BIGINT REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  work_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT','SICK','LEAVE','ABSENT','OFF')),
  notes TEXT,
  UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  leave_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  approved_by BIGINT REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT REFERENCES branches(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','FINALIZED','PAID')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id BIGSERIAL PRIMARY KEY,
  payroll_period_id BIGINT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  base_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowance NUMERIC(14,2) NOT NULL DEFAULT 0,
  deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(14,2) GENERATED ALWAYS AS (base_salary + allowance - deduction) STORED,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','PAID')),
  paid_at TIMESTAMPTZ,
  UNIQUE(payroll_period_id, employee_id)
);

CREATE OR REPLACE VIEW v_public_doctors AS
SELECT
  dp.id AS doctor_id,
  e.full_name,
  dp.specialization,
  dp.biography,
  dp.photo_url,
  e.branch_id,
  b.name AS branch_name
FROM doctor_profiles dp
JOIN employees e ON e.id = dp.employee_id
LEFT JOIN branches b ON b.id = e.branch_id
WHERE dp.is_active = TRUE
  AND dp.show_on_public = TRUE
  AND e.is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_visits_branch ON visits(branch_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_branch ON prescriptions(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);

CREATE TABLE IF NOT EXISTS site_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_eyebrow VARCHAR(80) NOT NULL DEFAULT 'BIM CLINICS',
  hero_title VARCHAR(200) NOT NULL DEFAULT 'Pelayanan kesehatan yang dekat, jelas, dan terpercaya.',
  hero_subtitle TEXT NOT NULL DEFAULT 'Konsultasi dokter, layanan apotek, serta dokumen medis yang dapat diverifikasi secara digital.',
  hero_image_url TEXT,
  about_title VARCHAR(150) NOT NULL DEFAULT 'Tentang Kami',
  about_content TEXT NOT NULL DEFAULT 'BIM CLINICS adalah klinik yang berkomitmen memberikan pelayanan kesehatan yang cepat, jelas, dan dapat dipercaya bagi masyarakat.',
  contact_phone VARCHAR(30) NOT NULL DEFAULT '+620000000000',
  contact_address TEXT,
  footer_tagline VARCHAR(200) NOT NULL DEFAULT 'Pelayanan kesehatan terintegrasi.',
  updated_by BIGINT REFERENCES employees(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_facilities (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_facilities_order ON site_facilities(sort_order);

COMMIT;
