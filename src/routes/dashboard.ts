import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin, userBranchId } from '../lib/branchAccess.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get('/summary', async (req, res) => {
  const branchId = isAdmin(req) ? null : userBranchId(req);
  const today = new Date().toISOString().slice(0, 10);

  const q = await pool.query(
    `WITH patients_today AS (
       SELECT COUNT(*)::int AS n
       FROM visits
       WHERE visit_date = $1::date
         AND ($2::bigint IS NULL OR branch_id = $2)
     ),
     waiting_doctor AS (
       SELECT COUNT(*)::int AS n
       FROM visits
       WHERE status = 'WAITING_DOCTOR'
         AND ($2::bigint IS NULL OR branch_id = $2)
     ),
     pending_prescriptions AS (
       SELECT COUNT(*)::int AS n
       FROM prescriptions
       WHERE status IN ('SUBMITTED','PREPARING')
         AND ($2::bigint IS NULL OR branch_id = $2)
     ),
     revenue_today AS (
       SELECT COALESCE(SUM(p.amount),0) AS total
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.paid_at::date = $1::date
         AND ($2::bigint IS NULL OR i.branch_id = $2)
     ),
     cogs_today AS (
       SELECT COALESCE(SUM(sm.qty * mb.purchase_price),0) AS total
       FROM stock_movements sm
       JOIN medication_batches mb ON mb.id = sm.batch_id
       WHERE sm.movement_type = 'OUT'
         AND sm.reference_type = 'PRESCRIPTION'
         AND sm.created_at::date = $1::date
         AND ($2::bigint IS NULL OR mb.branch_id = $2)
     ),
     opex_today AS (
       SELECT COALESCE(SUM(amount),0) AS total
       FROM expenses
       WHERE expense_date = $1::date
         AND ($2::bigint IS NULL OR branch_id = $2)
     )
     SELECT
       patients_today.n AS patients_today,
       waiting_doctor.n AS waiting_doctor,
       pending_prescriptions.n AS pending_prescriptions,
       revenue_today.total - cogs_today.total - opex_today.total AS net_profit_today
     FROM patients_today, waiting_doctor, pending_prescriptions, revenue_today, cogs_today, opex_today`,
    [today, branchId]
  );

  res.json(q.rows[0]);
});
