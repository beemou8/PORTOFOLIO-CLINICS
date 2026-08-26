import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { branchForWrite, canAccessBranch, isAdmin, userBranchId } from '../lib/branchAccess.js';

export const financeRouter = Router();
financeRouter.use(requireAuth, allowRoles('ADMIN', 'FINANCE'));

const invoiceSchema = z.object({
  branchId: z.number().int().positive().optional().nullable(),
  visitId: z.number().int().positive().optional().nullable(),
  patientId: z.number().int().positive(),
  items: z.array(z.object({
    itemType: z.enum(['SERVICE', 'MEDICATION', 'OTHER']),
    referenceId: z.number().int().positive().optional().nullable(),
    description: z.string().min(1),
    qty: z.number().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
  discount: z.number().nonnegative().default(0),
});

financeRouter.post('/invoices', async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid' });
  const d = parsed.data;
  const branchId = branchForWrite(req, d.branchId);
  if (!branchId) return res.status(400).json({ message: 'Cabang invoice wajib dipilih.' });

  if (d.visitId) {
    const v = await pool.query('SELECT branch_id FROM visits WHERE id = $1', [d.visitId]);
    if (!v.rowCount || v.rows[0].branch_id !== branchId) return res.status(400).json({ message: 'Kunjungan tidak sesuai cabang invoice.' });
  }

  const subtotal = d.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const total = Math.max(0, subtotal - d.discount);
  const invoiceNo = `INV-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Date.now().toString().slice(-6)}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = await client.query(
      `INSERT INTO invoices(invoice_no, branch_id, visit_id, patient_id, subtotal, discount, total, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'UNPAID',$8) RETURNING *`,
      [invoiceNo, branchId, d.visitId ?? null, d.patientId, subtotal, d.discount, total, req.user!.employeeId]
    );
    for (const item of d.items) {
      await client.query(
        `INSERT INTO invoice_items(invoice_id, item_type, reference_id, description, qty, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [inv.rows[0].id, item.itemType, item.referenceId ?? null, item.description, item.qty, item.unitPrice, item.qty * item.unitPrice]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(inv.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

financeRouter.post('/invoices/:id/payments', async (req, res) => {
  const invoiceId = Number(req.params.id);
  const amount = Number(req.body.amount);
  const method = String(req.body.method ?? 'CASH');
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Nominal tidak valid' });

  const invoice = await pool.query('SELECT branch_id FROM invoices WHERE id = $1', [invoiceId]);
  if (!invoice.rowCount) return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
  if (!canAccessBranch(req, invoice.rows[0].branch_id)) return res.status(403).json({ message: 'Invoice berada di cabang lain.' });

  const q = await pool.query(
    `INSERT INTO payments(invoice_id, amount, method, received_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [invoiceId, amount, method, req.user!.employeeId]
  );

  await pool.query(`
    UPDATE invoices i
    SET status = CASE
      WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id),0) >= i.total THEN 'PAID'
      WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id),0) > 0 THEN 'PARTIAL'
      ELSE 'UNPAID' END,
      updated_at = NOW()
    WHERE i.id = $1
  `, [invoiceId]);

  res.status(201).json(q.rows[0]);
});

financeRouter.post('/expenses', async (req, res) => {
  const { branchId: requestedBranchId, category, description, amount, expenseDate } = req.body;
  const branchId = branchForWrite(req, requestedBranchId ? Number(requestedBranchId) : null);
  if (!branchId) return res.status(400).json({ message: 'Cabang expense wajib dipilih.' });
  const q = await pool.query(
    `INSERT INTO expenses(branch_id, category, description, amount, expense_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [branchId, category, description, amount, expenseDate, req.user!.employeeId]
  );
  res.status(201).json(q.rows[0]);
});

financeRouter.get('/pnl', async (req, res) => {
  const from = String(req.query.from ?? new Date().toISOString().slice(0, 7) + '-01');
  const to = String(req.query.to ?? new Date().toISOString().slice(0, 10));
  const requestedBranch = req.query.branchId ? Number(req.query.branchId) : null;
  const branchId = isAdmin(req) ? requestedBranch : userBranchId(req);

  const q = await pool.query(
    `WITH revenue AS (
       SELECT COALESCE(SUM(p.amount),0) total
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.paid_at::date BETWEEN $1::date AND $2::date
         AND ($3::bigint IS NULL OR i.branch_id = $3)
     ),
     cogs AS (
       SELECT COALESCE(SUM(sm.qty * mb.purchase_price),0) total
       FROM stock_movements sm
       JOIN medication_batches mb ON mb.id = sm.batch_id
       WHERE sm.movement_type = 'OUT'
         AND sm.reference_type = 'PRESCRIPTION'
         AND sm.created_at::date BETWEEN $1::date AND $2::date
         AND ($3::bigint IS NULL OR mb.branch_id = $3)
     ),
     opex AS (
       SELECT COALESCE(SUM(amount),0) total
       FROM expenses
       WHERE expense_date BETWEEN $1::date AND $2::date
         AND ($3::bigint IS NULL OR branch_id = $3)
     ),
     payroll AS (
       SELECT COALESCE(SUM(net_salary),0) total
       FROM payroll_items pi
       JOIN payroll_periods pp ON pp.id = pi.payroll_period_id
       WHERE pi.status = 'PAID'
         AND pi.paid_at::date BETWEEN $1::date AND $2::date
         AND ($3::bigint IS NULL OR pp.branch_id = $3)
     )
     SELECT revenue.total AS revenue,
            cogs.total AS cogs,
            revenue.total - cogs.total AS gross_profit,
            opex.total AS operating_expenses,
            payroll.total AS payroll_expense,
            revenue.total - cogs.total - opex.total - payroll.total AS net_profit
     FROM revenue, cogs, opex, payroll`,
    [from, to, branchId]
  );
  res.json({ from, to, branchId, ...q.rows[0] });
});
