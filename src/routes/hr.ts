import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, withTransaction } from '../config/db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { branchForWrite, canAccessBranch, isAdmin, userBranchId } from '../lib/branchAccess.js';
import { deleteLocalUpload, saveLocalImage } from '../lib/localUploads.js';

export const hrRouter = Router();
hrRouter.use(requireAuth, allowRoles('ADMIN', 'HR'));

const employeeSchema = z.object({
  branchId: z.number().int().positive().nullable().optional(),
  employeeCode: z.string().trim().min(1),
  fullName: z.string().trim().min(2),
  employeeType: z.enum(['DOCTOR', 'PHARMACY', 'ADMIN', 'FINANCE', 'HR', 'NURSE', 'OTHER']),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  username: z.string().trim().min(3).optional(),
  password: z.string().min(8).optional(),
  roles: z.array(z.string()).optional(),
  specialization: z.string().optional().nullable(),
  sipNumber: z.string().optional().nullable(),
  biography: z.string().optional().nullable(),
  showOnPublic: z.boolean().optional(),
});

hrRouter.get('/employees', async (req, res) => {
  const scopedBranch = isAdmin(req) ? null : userBranchId(req);
  const q = await pool.query(`
    SELECT e.*, b.name AS branch_name, b.code AS branch_code,
           dp.id AS doctor_id, dp.specialization, dp.sip_number, dp.biography,
           dp.photo_url, dp.show_on_public
    FROM employees e
    LEFT JOIN branches b ON b.id = e.branch_id
    LEFT JOIN doctor_profiles dp ON dp.employee_id = e.id
    WHERE ($1::bigint IS NULL OR e.branch_id = $1)
    ORDER BY b.name NULLS LAST, e.full_name
  `, [scopedBranch]);
  res.json(q.rows);
});

hrRouter.post('/employees', async (req, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid', errors: parsed.error.flatten() });
  const d = parsed.data;

  if (!isAdmin(req) && d.employeeType === 'ADMIN') {
    return res.status(403).json({ message: 'Hanya ADMIN yang dapat membuat akun ADMIN.' });
  }

  const branchId = branchForWrite(req, d.branchId);
  if (!branchId) return res.status(400).json({ message: 'Cabang pegawai wajib dipilih.' });

  const branch = await pool.query('SELECT id FROM branches WHERE id = $1 AND is_active = TRUE', [branchId]);
  if (!branch.rowCount) return res.status(400).json({ message: 'Cabang tidak ditemukan / tidak aktif.' });

  const result = await withTransaction(async (client) => {
    const emp = await client.query(
      `INSERT INTO employees
       (branch_id, employee_code, full_name, employee_type, phone, email, hire_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [branchId, d.employeeCode, d.fullName, d.employeeType, d.phone ?? null, d.email ?? null, d.hireDate ?? null]
    );

    const employee = emp.rows[0];

    if (d.employeeType === 'DOCTOR') {
      await client.query(
        `UPDATE doctor_profiles
         SET specialization = $2, sip_number = $3, biography = $4,
             show_on_public = COALESCE($5, show_on_public), updated_at = NOW()
         WHERE employee_id = $1`,
        [employee.id, d.specialization ?? null, d.sipNumber ?? null, d.biography ?? null, d.showOnPublic ?? false]
      );
    }

    if (d.username || d.password) {
      if (!d.username || !d.password) throw new Error('Username dan password harus diisi bersamaan.');
      const hash = await bcrypt.hash(d.password, 12);
      const ua = await client.query(
        `INSERT INTO user_accounts(employee_id, username, password_hash)
         VALUES ($1,$2,$3) RETURNING id`,
        [employee.id, d.username, hash]
      );

      const userId = ua.rows[0].id;
      const roles = d.roles?.length ? d.roles : (d.employeeType === 'OTHER' ? [] : [d.employeeType]);
      if (!isAdmin(req) && roles.includes('ADMIN')) throw new Error('Role ADMIN hanya dapat diberikan oleh ADMIN.');
      if (roles.length) {
        await client.query(
          `INSERT INTO user_roles(user_id, role_id)
           SELECT $1, id FROM roles WHERE code = ANY($2::text[])
           ON CONFLICT DO NOTHING`,
          [userId, roles]
        );
      }
    }

    return employee;
  });

  res.status(201).json(result);
});

hrRouter.patch('/doctors/:doctorId/public', async (req, res) => {
  const doctorId = Number(req.params.doctorId);
  const owner = await pool.query(
    `SELECT e.branch_id, dp.photo_url FROM doctor_profiles dp JOIN employees e ON e.id = dp.employee_id WHERE dp.id = $1`,
    [doctorId]
  );
  if (!owner.rowCount) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
  if (!canAccessBranch(req, owner.rows[0].branch_id)) return res.status(403).json({ message: 'Dokter berada di cabang lain.' });

  const show = Boolean(req.body.showOnPublic);
  const q = await pool.query(
    `UPDATE doctor_profiles SET show_on_public = $2, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [doctorId, show]
  );
  res.json(q.rows[0]);
});

const photoSchema = z.object({
  mimeType: z.string().min(1),
  dataBase64: z.string().min(1),
});

hrRouter.post('/doctors/:doctorId/photo', async (req, res) => {
  const doctorId = Number(req.params.doctorId);
  const parsed = photoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'File foto tidak valid.' });

  const owner = await pool.query(
    `SELECT e.branch_id, dp.photo_url FROM doctor_profiles dp JOIN employees e ON e.id = dp.employee_id WHERE dp.id = $1`,
    [doctorId]
  );
  if (!owner.rowCount) return res.status(404).json({ message: 'Dokter tidak ditemukan.' });
  if (!canAccessBranch(req, owner.rows[0].branch_id)) return res.status(403).json({ message: 'Dokter berada di cabang lain.' });

  let saved: Awaited<ReturnType<typeof saveLocalImage>> | null = null;
  try {
    saved = await saveLocalImage({
      subdir: 'doctors',
      filePrefix: `doctor-${doctorId}`,
      mimeType: parsed.data.mimeType,
      dataBase64: parsed.data.dataBase64,
    });

    const q = await pool.query(
      `UPDATE doctor_profiles SET photo_url = $2, updated_at = NOW() WHERE id = $1 RETURNING id, photo_url`,
      [doctorId, saved.publicUrl]
    );

    await deleteLocalUpload(owner.rows[0].photo_url);
    res.json(q.rows[0]);
  } catch (error) {
    if (saved) await deleteLocalUpload(saved.publicUrl);
    const message = error instanceof Error ? error.message : 'Gagal menyimpan foto dokter.';
    res.status(400).json({ message });
  }
});
