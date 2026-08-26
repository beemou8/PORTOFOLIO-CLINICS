import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin, userBranchId } from '../lib/branchAccess.js';

export const doctorsRouter = Router();

doctorsRouter.get('/', requireAuth, async (req, res) => {
  const requestedBranch = req.query.branchId ? Number(req.query.branchId) : null;
  const branchId = isAdmin(req) ? requestedBranch : userBranchId(req);
  const q = await pool.query(`
    SELECT dp.id AS doctor_id, e.id AS employee_id, e.employee_code,
           e.full_name, e.phone, e.email, e.branch_id, b.name AS branch_name,
           dp.specialization, dp.sip_number, dp.biography, dp.photo_url,
           dp.show_on_public, dp.is_active
    FROM doctor_profiles dp
    JOIN employees e ON e.id = dp.employee_id
    LEFT JOIN branches b ON b.id = e.branch_id
    WHERE dp.is_active = TRUE AND e.is_active = TRUE
      AND ($1::bigint IS NULL OR e.branch_id = $1)
    ORDER BY e.full_name
  `, [branchId]);
  res.json(q.rows);
});

doctorsRouter.get('/public', async (_req, res) => {
  const q = await pool.query('SELECT * FROM v_public_doctors ORDER BY branch_name, full_name');
  res.json(q.rows);
});
