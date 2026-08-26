import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../config/db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { branchForWrite, canAccessBranch, isAdmin, userBranchId } from '../lib/branchAccess.js';

export const pharmacyRouter = Router();
pharmacyRouter.use(requireAuth);

pharmacyRouter.get('/medications', allowRoles('ADMIN', 'PHARMACY', 'DOCTOR'), async (req, res) => {
  const requestedBranch = req.query.branchId ? Number(req.query.branchId) : null;
  const branchId = isAdmin(req) ? requestedBranch : userBranchId(req);

  const q = await pool.query(`
    SELECT m.*, COALESCE(SUM(mb.current_stock) FILTER (WHERE $1::bigint IS NULL OR mb.branch_id = $1),0) AS total_stock
    FROM medications m
    LEFT JOIN medication_batches mb ON mb.medication_id = m.id
    WHERE m.is_active = TRUE
    GROUP BY m.id
    ORDER BY m.name
  `, [branchId]);
  res.json(q.rows);
});

pharmacyRouter.get('/prescriptions', allowRoles('ADMIN', 'PHARMACY'), async (req, res) => {
  const status = String(req.query.status ?? 'SUBMITTED');
  const requestedBranch = req.query.branchId ? Number(req.query.branchId) : null;
  const branchId = isAdmin(req) ? requestedBranch : userBranchId(req);
  const q = await pool.query(
    `SELECT p.id, p.status, p.created_at, p.notes, p.branch_id,
            pt.full_name AS patient_name, e.full_name AS doctor_name, b.name AS branch_name,
            json_agg(json_build_object(
              'itemId', pi.id,
              'medicationId', m.id,
              'medication', m.name,
              'qty', pi.qty,
              'dosage', pi.dosage,
              'frequency', pi.frequency,
              'instruction', pi.instruction
            ) ORDER BY pi.id) AS items
     FROM prescriptions p
     JOIN visits v ON v.id = p.visit_id
     JOIN patients pt ON pt.id = v.patient_id
     JOIN doctor_profiles dp ON dp.id = p.doctor_id
     JOIN employees e ON e.id = dp.employee_id
     JOIN branches b ON b.id = p.branch_id
     JOIN prescription_items pi ON pi.prescription_id = p.id
     JOIN medications m ON m.id = pi.medication_id
     WHERE p.status = $1
       AND ($2::bigint IS NULL OR p.branch_id = $2)
     GROUP BY p.id, pt.full_name, e.full_name, b.name
     ORDER BY p.created_at`,
    [status, branchId]
  );
  res.json(q.rows);
});

const medicationSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  genericName: z.string().optional().nullable(),
  unit: z.string().min(1),
  sellPrice: z.number().nonnegative(),
  minStock: z.number().nonnegative().default(0),
});

pharmacyRouter.post('/medications', allowRoles('ADMIN', 'PHARMACY'), async (req, res) => {
  const parsed = medicationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid' });
  const d = parsed.data;
  const q = await pool.query(
    `INSERT INTO medications(sku, name, generic_name, unit, sell_price, min_stock)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [d.sku, d.name, d.genericName ?? null, d.unit, d.sellPrice, d.minStock]
  );
  res.status(201).json(q.rows[0]);
});

const batchSchema = z.object({
  medicationId: z.number().int().positive(),
  branchId: z.number().int().positive().optional().nullable(),
  batchNo: z.string().min(1),
  expiryDate: z.string(),
  purchasePrice: z.number().nonnegative(),
  qty: z.number().positive(),
});

pharmacyRouter.post('/batches', allowRoles('ADMIN', 'PHARMACY'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid' });
  const d = parsed.data;
  const branchId = branchForWrite(req, d.branchId);
  if (!branchId) return res.status(400).json({ message: 'Cabang stok wajib dipilih.' });

  const result = await withTransaction(async (client) => {
    const b = await client.query(
      `INSERT INTO medication_batches(medication_id, branch_id, batch_no, expiry_date, purchase_price, current_stock)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.medicationId, branchId, d.batchNo, d.expiryDate, d.purchasePrice, d.qty]
    );
    await client.query(
      `INSERT INTO stock_movements(batch_id, movement_type, qty, reference_type, reference_id, created_by)
       VALUES ($1,'IN',$2,'PURCHASE',NULL,$3)`,
      [b.rows[0].id, d.qty, req.user!.employeeId]
    );
    return b.rows[0];
  });
  res.status(201).json(result);
});

pharmacyRouter.post('/prescriptions/:id/dispense', allowRoles('ADMIN', 'PHARMACY'), async (req, res) => {
  const prescriptionId = Number(req.params.id);

  try {
    const result = await withTransaction(async (client) => {
      const p = await client.query(`SELECT * FROM prescriptions WHERE id = $1 FOR UPDATE`, [prescriptionId]);
      if (!p.rowCount) throw new Error('Resep tidak ditemukan');
      if (!canAccessBranch(req, p.rows[0].branch_id)) throw new Error('Resep berada di cabang lain');
      if (p.rows[0].status !== 'SUBMITTED') throw new Error('Resep sudah diproses / tidak aktif');

      const items = await client.query(
        `SELECT pi.*, m.name AS medication_name
         FROM prescription_items pi
         JOIN medications m ON m.id = pi.medication_id
         WHERE prescription_id = $1`,
        [prescriptionId]
      );

      for (const item of items.rows) {
        const stock = await client.query(
          `SELECT COALESCE(SUM(current_stock),0) AS total
           FROM medication_batches
           WHERE medication_id = $1 AND branch_id = $2
             AND current_stock > 0 AND expiry_date >= CURRENT_DATE`,
          [item.medication_id, p.rows[0].branch_id]
        );
        if (Number(stock.rows[0].total) < Number(item.qty)) {
          throw new Error(`Stok ${item.medication_name} tidak cukup`);
        }
      }

      for (const item of items.rows) {
        let remaining = Number(item.qty);
        const batches = await client.query(
          `SELECT * FROM medication_batches
           WHERE medication_id = $1 AND branch_id = $2
             AND current_stock > 0 AND expiry_date >= CURRENT_DATE
           ORDER BY expiry_date ASC, id ASC
           FOR UPDATE`,
          [item.medication_id, p.rows[0].branch_id]
        );

        for (const batch of batches.rows) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, Number(batch.current_stock));
          await client.query(
            `UPDATE medication_batches SET current_stock = current_stock - $2, updated_at = NOW() WHERE id = $1`,
            [batch.id, take]
          );
          await client.query(
            `INSERT INTO stock_movements(batch_id, movement_type, qty, reference_type, reference_id, created_by)
             VALUES ($1,'OUT',$2,'PRESCRIPTION',$3,$4)`,
            [batch.id, take, prescriptionId, req.user!.employeeId]
          );
          remaining -= take;
        }
      }

      const updated = await client.query(
        `UPDATE prescriptions SET status = 'DISPENSED', dispensed_by = $2, dispensed_at = NOW(), updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [prescriptionId, req.user!.employeeId]
      );
      await client.query(`UPDATE visits SET status = 'WAITING_PAYMENT', updated_at = NOW() WHERE id = $1`, [p.rows[0].visit_id]);
      return updated.rows[0];
    });

    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e instanceof Error ? e.message : 'Gagal memproses resep' });
  }
});
