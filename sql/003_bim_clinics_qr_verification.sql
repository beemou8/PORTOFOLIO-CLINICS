BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SEQUENCE IF NOT EXISTS medical_document_no_seq START WITH 1;

ALTER TABLE medical_documents
  ADD COLUMN IF NOT EXISTS document_no VARCHAR(60),
  ADD COLUMN IF NOT EXISTS verification_token UUID,
  ADD COLUMN IF NOT EXISTS verification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS rest_start_date DATE,
  ADD COLUMN IF NOT EXISTS rest_end_date DATE;

UPDATE medical_documents
SET document_no = 'BIM-MED-' || TO_CHAR(created_at::date, 'YYYYMMDD') || '-' || LPAD(id::text, 6, '0')
WHERE document_no IS NULL;

UPDATE medical_documents
SET verification_token = gen_random_uuid()
WHERE verification_token IS NULL;

SELECT setval('medical_document_no_seq', COALESCE((SELECT MAX(id) FROM medical_documents), 0) + 1, false);

ALTER TABLE medical_documents
  ALTER COLUMN document_no SET NOT NULL,
  ALTER COLUMN document_no SET DEFAULT (
    'BIM-MED-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('medical_document_no_seq')::text, 6, '0')
  ),
  ALTER COLUMN verification_token SET NOT NULL,
  ALTER COLUMN verification_token SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS uq_medical_documents_document_no
  ON medical_documents(document_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_medical_documents_verification_token
  ON medical_documents(verification_token);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medical_documents_rest_date_check'
  ) THEN
    ALTER TABLE medical_documents
      ADD CONSTRAINT medical_documents_rest_date_check
      CHECK (rest_end_date IS NULL OR rest_start_date IS NULL OR rest_end_date >= rest_start_date);
  END IF;
END $$;

COMMIT;
