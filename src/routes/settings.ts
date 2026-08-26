import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { deleteLocalUpload, saveLocalImage } from '../lib/localUploads.js';

export const settingsRouter = Router();

const PUBLIC_COLUMNS = `
  hero_eyebrow, hero_title, hero_subtitle, hero_image_url,
  about_title, about_content,
  contact_phone, contact_address, footer_tagline
`;

// Publik: dipakai landing page, tidak butuh login.
settingsRouter.get('/public', async (_req, res) => {
  const q = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM site_settings WHERE id = 1`);
  res.json(q.rows[0] ?? {});
});

settingsRouter.get('/facilities/public', async (_req, res) => {
  const q = await pool.query(
    `SELECT id, title, description, image_url FROM site_facilities WHERE is_active = TRUE ORDER BY sort_order, id`
  );
  res.json(q.rows);
});

// Internal: hanya role ADMIN yang boleh melihat/mengubah pengaturan konten.
settingsRouter.use(requireAuth, allowRoles('ADMIN'));

settingsRouter.get('/', async (_req, res) => {
  const q = await pool.query(`SELECT * FROM site_settings WHERE id = 1`);
  res.json(q.rows[0] ?? {});
});

const settingsSchema = z.object({
  heroEyebrow: z.string().trim().min(1).max(80),
  heroTitle: z.string().trim().min(1).max(200),
  heroSubtitle: z.string().trim().min(1).max(2000),
  aboutTitle: z.string().trim().min(1).max(150),
  aboutContent: z.string().trim().min(1).max(4000),
  contactPhone: z.string().trim().min(1).max(30),
  contactAddress: z.string().trim().max(500).optional().nullable(),
  footerTagline: z.string().trim().min(1).max(200),
});

settingsRouter.put('/', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input pengaturan tidak valid' });
  const d = parsed.data;

  const q = await pool.query(
    `UPDATE site_settings
     SET hero_eyebrow = $1, hero_title = $2, hero_subtitle = $3,
         about_title = $4, about_content = $5,
         contact_phone = $6, contact_address = $7, footer_tagline = $8,
         updated_by = $9, updated_at = NOW()
     WHERE id = 1
     RETURNING *`,
    [
      d.heroEyebrow, d.heroTitle, d.heroSubtitle,
      d.aboutTitle, d.aboutContent,
      d.contactPhone, d.contactAddress ?? null, d.footerTagline,
      req.user!.employeeId,
    ]
  );
  res.json(q.rows[0]);
});

// Upload foto latar hero (dipisah dari PUT /settings supaya form teks tidak perlu ikut kirim base64 setiap kali disimpan).
const heroImageSchema = z.object({
  mimeType: z.string().min(1),
  dataBase64: z.string().min(1),
});

settingsRouter.post('/hero-image', async (req, res) => {
  const parsed = heroImageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'File foto tidak valid.' });

  const previous = await pool.query(`SELECT hero_image_url FROM site_settings WHERE id = 1`);
  let saved: Awaited<ReturnType<typeof saveLocalImage>> | null = null;

  try {
    saved = await saveLocalImage({
      subdir: 'site',
      filePrefix: 'hero',
      mimeType: parsed.data.mimeType,
      dataBase64: parsed.data.dataBase64,
    });

    const q = await pool.query(
      `UPDATE site_settings SET hero_image_url = $1, updated_by = $2, updated_at = NOW() WHERE id = 1 RETURNING *`,
      [saved.publicUrl, req.user!.employeeId]
    );

    await deleteLocalUpload(previous.rows[0]?.hero_image_url);
    res.json(q.rows[0]);
  } catch (error) {
    if (saved) await deleteLocalUpload(saved.publicUrl);
    const message = error instanceof Error ? error.message : 'Gagal menyimpan foto hero.';
    res.status(400).json({ message });
  }
});

settingsRouter.get('/facilities', async (_req, res) => {
  const q = await pool.query(`SELECT * FROM site_facilities ORDER BY sort_order, id`);
  res.json(q.rows);
});

const facilitySchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

settingsRouter.post('/facilities', async (req, res) => {
  const parsed = facilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input fasilitas tidak valid' });
  const d = parsed.data;
  const q = await pool.query(
    `INSERT INTO site_facilities(title, description, sort_order) VALUES ($1,$2,$3) RETURNING *`,
    [d.title, d.description ?? null, d.sortOrder]
  );
  res.status(201).json(q.rows[0]);
});

settingsRouter.put('/facilities/:id', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = facilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input fasilitas tidak valid' });
  const d = parsed.data;
  const q = await pool.query(
    `UPDATE site_facilities SET title = $2, description = $3, sort_order = $4, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, d.title, d.description ?? null, d.sortOrder]
  );
  if (!q.rowCount) return res.status(404).json({ message: 'Fasilitas tidak ditemukan' });
  res.json(q.rows[0]);
});

settingsRouter.post('/facilities/:id/image', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID fasilitas tidak valid.' });

  const parsed = heroImageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'File foto tidak valid.' });

  const previous = await pool.query(`SELECT image_url FROM site_facilities WHERE id = $1`, [id]);
  if (!previous.rowCount) return res.status(404).json({ message: 'Fasilitas tidak ditemukan.' });

  let saved: Awaited<ReturnType<typeof saveLocalImage>> | null = null;
  try {
    saved = await saveLocalImage({
      subdir: 'facilities',
      filePrefix: `facility-${id}`,
      mimeType: parsed.data.mimeType,
      dataBase64: parsed.data.dataBase64,
    });

    const q = await pool.query(
      `UPDATE site_facilities SET image_url = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, saved.publicUrl]
    );

    await deleteLocalUpload(previous.rows[0]?.image_url);
    res.json(q.rows[0]);
  } catch (error) {
    if (saved) await deleteLocalUpload(saved.publicUrl);
    const message = error instanceof Error ? error.message : 'Gagal menyimpan foto fasilitas.';
    res.status(400).json({ message });
  }
});

settingsRouter.delete('/facilities/:id/image', async (req, res) => {
  const id = Number(req.params.id);
  const previous = await pool.query(`SELECT image_url FROM site_facilities WHERE id = $1`, [id]);
  if (!previous.rowCount) return res.status(404).json({ message: 'Fasilitas tidak ditemukan.' });

  const q = await pool.query(
    `UPDATE site_facilities SET image_url = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  await deleteLocalUpload(previous.rows[0]?.image_url);
  res.json(q.rows[0]);
});

settingsRouter.patch('/facilities/:id/active', async (req, res) => {
  const id = Number(req.params.id);
  const isActive = Boolean(req.body.isActive);
  const q = await pool.query(
    `UPDATE site_facilities SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, isActive]
  );
  if (!q.rowCount) return res.status(404).json({ message: 'Fasilitas tidak ditemukan' });
  res.json(q.rows[0]);
});

settingsRouter.delete('/facilities/:id', async (req, res) => {
  const id = Number(req.params.id);
  const q = await pool.query(`DELETE FROM site_facilities WHERE id = $1 RETURNING id, image_url`, [id]);
  if (!q.rowCount) return res.status(404).json({ message: 'Fasilitas tidak ditemukan' });
  await deleteLocalUpload(q.rows[0]?.image_url);
  res.status(204).send();
});
