import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { isAdmin, userBranchId } from '../lib/branchAccess.js';

export const branchesRouter = Router();
branchesRouter.use(requireAuth);

branchesRouter.get('/', async (req, res) => {
  if (isAdmin(req)) {
    const q = await pool.query(`SELECT id, code, name, address, phone, is_active FROM branches WHERE is_active = TRUE ORDER BY name`);
    return res.json(q.rows);
  }

  const branchId = userBranchId(req);
  if (!branchId) return res.json([]);
  const q = await pool.query(`SELECT id, code, name, address, phone, is_active FROM branches WHERE id = $1 AND is_active = TRUE`, [branchId]);
  res.json(q.rows);
});

const branchSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(150),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

branchesRouter.post('/', allowRoles('ADMIN'), async (req, res) => {
  const parsed = branchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input cabang tidak valid' });
  const d = parsed.data;
  const q = await pool.query(
    `INSERT INTO branches(code, name, address, phone)
     VALUES (UPPER($1),$2,$3,$4) RETURNING *`,
    [d.code, d.name, d.address ?? null, d.phone ?? null]
  );
  res.status(201).json(q.rows[0]);
});
