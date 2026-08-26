import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../config/db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { canAccessBranch } from '../lib/branchAccess.js';

export const prescriptionsRouter = Router();
prescriptionsRouter.use(requireAuth);

const prescriptionSchema = z.object({
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    medicationId: z.number().int().positive(),
    qty: z.number().positive(),
    dosage: z.string().optional().nullable(),
    frequency: z.string().optional().nullable(),
    durationDays: z.number().int().positive().optional().nullable(),
    instruction: z.string().optional().nullable(),
  })).min(1),
});

prescriptionsRouter.post('/visit/:visitId', allowRoles('DOCTOR'), async (req, res) => {
  const visitId = Number(req.params.visitId);
  const parsed = prescriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid', errors: parsed.error.flatten() });

  const doctor = await pool.query('SELECT id FROM doctor_profiles WHERE employee_id = $1 AND is_active = TRUE', [req.user!.employeeId]);
  if (!doctor.rowCount) return res.status(403).json({ message: 'Akun ini bukan dokter aktif' });

  const visit = await pool.query('SELECT branch_id, doctor_id FROM visits WHERE id = $1', [visitId]);
  if (!visit.rowCount) return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });
  if (!canAccessBranch(req, visit.rows[0].branch_id)) return res.status(403).json({ message: 'Kunjungan berada di cabang lain.' });
  if (visit.rows[0].doctor_id && visit.rows[0].doctor_id !== doctor.rows[0].id) {
    return res.status(403).json({ message: 'Pasien ini terdaftar ke dokter lain.' });
  }

  const result = await withTransaction(async (client) => {
    const p = await client.query(
      `INSERT INTO prescriptions(visit_id, doctor_id, branch_id, status, notes)
       VALUES ($1,$2,$3,'SUBMITTED',$4) RETURNING *`,
      [visitId, doctor.rows[0].id, visit.rows[0].branch_id, parsed.data.notes ?? null]
    );

    for (const item of parsed.data.items) {
      await client.query(
        `INSERT INTO prescription_items
         (prescription_id, medication_id, qty, dosage, frequency, duration_days, instruction)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [p.rows[0].id, item.medicationId, item.qty, item.dosage ?? null,
         item.frequency ?? null, item.durationDays ?? null, item.instruction ?? null]
      );
    }
    await client.query(`UPDATE visits SET status = 'WAITING_PHARMACY', updated_at = NOW() WHERE id = $1`, [visitId]);
    return p.rows[0];
  });

  res.status(201).json(result);
});
