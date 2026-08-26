BEGIN;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

COMMIT;
