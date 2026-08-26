import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { branchForWrite, canAccessBranch, isAdmin, userBranchId } from '../lib/branchAccess.js';

export const visitsRouter = Router();
visitsRouter.use(requireAuth);

const visitSchema = z.object({
  branchId: z.coerce.number().int().positive().optional().nullable(),
  patientId: z.coerce.number().int().positive(),
  doctorId: z.coerce.number().int().positive().optional().nullable(),
  complaint: z.string().optional().nullable(),
});

visitsRouter.post('/', allowRoles('ADMIN', 'NURSE', 'HR'), async (req, res) => {
  const parsed = visitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid', errors: parsed.error.flatten() });
  const d = parsed.data;
  const branchId = branchForWrite(req, d.branchId);
  if (!branchId) return res.status(400).json({ message: 'Cabang kunjungan wajib dipilih.' });

  if (d.doctorId) {
    const doctor = await pool.query(
      `SELECT e.branch_id FROM doctor_profiles dp JOIN employees e ON e.id = dp.employee_id
       WHERE dp.id = $1 AND dp.is_active = TRUE AND e.is_active = TRUE`,
      [d.doctorId]
    );
    if (!doctor.rowCount || Number(doctor.rows[0].branch_id) !== Number(branchId)) {
      return res.status(400).json({ message: 'Dokter tidak tersedia di cabang yang dipilih.' });
    }
  }

  const regNo = `REG-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Date.now().toString().slice(-6)}`;
  const q = await pool.query(
    `INSERT INTO visits(registration_no, branch_id, patient_id, doctor_id, complaint, status, registered_by)
     VALUES ($1,$2,$3,$4,$5,'WAITING_DOCTOR',$6) RETURNING *`,
    [regNo, branchId, d.patientId, d.doctorId ?? null, d.complaint ?? null, req.user!.employeeId]
  );
  res.status(201).json(q.rows[0]);
});

visitsRouter.get('/', async (req, res) => {
  const status = String(req.query.status ?? '');
  const requestedBranch = req.query.branchId ? Number(req.query.branchId) : null;
  const branchId = isAdmin(req) ? requestedBranch : userBranchId(req);
  const doctorOnly = req.user!.roles.includes('DOCTOR') && !isAdmin(req);

  const q = await pool.query(
    `SELECT v.*, p.full_name AS patient_name, e.full_name AS doctor_name, b.name AS branch_name
     FROM visits v
     JOIN patients p ON p.id = v.patient_id
     LEFT JOIN doctor_profiles dp ON dp.id = v.doctor_id
     LEFT JOIN employees e ON e.id = dp.employee_id
     LEFT JOIN branches b ON b.id = v.branch_id
     WHERE ($1 = '' OR v.status = $1)
       AND ($2::bigint IS NULL OR v.branch_id = $2)
       AND ($3::boolean = FALSE OR dp.employee_id = $4)
     ORDER BY v.created_at DESC LIMIT 200`,
    [status, branchId, doctorOnly, req.user!.employeeId]
  );
  res.json(q.rows);
});

const recordSchema = z.object({
  anamnesis: z.string().optional().nullable(),
  diagnosis: z.string().min(1),
  treatmentNotes: z.string().optional().nullable(),
  systolic: z.number().int().optional().nullable(),
  diastolic: z.number().int().optional().nullable(),
  temperature: z.number().optional().nullable(),
  weightKg: z.number().optional().nullable(),
});

visitsRouter.post('/:visitId/medical-record', allowRoles('DOCTOR'), async (req, res) => {
  const visitId = Number(req.params.visitId);
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid' });
  const d = parsed.data;

  const doctor = await pool.query('SELECT id FROM doctor_profiles WHERE employee_id = $1 AND is_active = TRUE', [req.user!.employeeId]);
  if (!doctor.rowCount) return res.status(403).json({ message: 'Akun ini bukan dokter aktif' });

  const visit = await pool.query('SELECT branch_id, doctor_id FROM visits WHERE id = $1', [visitId]);
  if (!visit.rowCount) return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });
  if (!canAccessBranch(req, visit.rows[0].branch_id)) return res.status(403).json({ message: 'Kunjungan berada di cabang lain.' });
  if (visit.rows[0].doctor_id && visit.rows[0].doctor_id !== doctor.rows[0].id) {
    return res.status(403).json({ message: 'Pasien ini terdaftar ke dokter lain.' });
  }

  const q = await pool.query(
    `INSERT INTO medical_records
     (visit_id, doctor_id, anamnesis, diagnosis, treatment_notes, systolic, diastolic, temperature, weight_kg)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (visit_id) DO UPDATE SET
       doctor_id = EXCLUDED.doctor_id,
       anamnesis = EXCLUDED.anamnesis,
       diagnosis = EXCLUDED.diagnosis,
       treatment_notes = EXCLUDED.treatment_notes,
       systolic = EXCLUDED.systolic,
       diastolic = EXCLUDED.diastolic,
       temperature = EXCLUDED.temperature,
       weight_kg = EXCLUDED.weight_kg,
       updated_at = NOW()
     RETURNING *`,
    [visitId, doctor.rows[0].id, d.anamnesis ?? null, d.diagnosis, d.treatmentNotes ?? null,
     d.systolic ?? null, d.diastolic ?? null, d.temperature ?? null, d.weightKg ?? null]
  );

  await pool.query(`UPDATE visits SET doctor_id = COALESCE(doctor_id,$2), status = 'IN_DOCTOR', updated_at = NOW() WHERE id = $1`, [visitId, doctor.rows[0].id]);
  res.json(q.rows[0]);
});

const documentSchema = z.object({
  documentType: z.enum(['SICK_LETTER', 'REFERRAL', 'MEDICAL_CERTIFICATE', 'OTHER']),
  title: z.string().min(1),
  content: z.string().min(1),
  restStartDate: z.string().optional().nullable(),
  restEndDate: z.string().optional().nullable(),
});

visitsRouter.post('/:visitId/documents', allowRoles('DOCTOR'), async (req, res) => {
  const visitId = Number(req.params.visitId);
  const parsed = documentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid' });

  const doctor = await pool.query('SELECT id FROM doctor_profiles WHERE employee_id = $1 AND is_active = TRUE', [req.user!.employeeId]);
  if (!doctor.rowCount) return res.status(403).json({ message: 'Akun ini bukan dokter aktif' });

  const visit = await pool.query('SELECT branch_id, doctor_id FROM visits WHERE id = $1', [visitId]);
  if (!visit.rowCount) return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });
  if (!canAccessBranch(req, visit.rows[0].branch_id)) return res.status(403).json({ message: 'Kunjungan berada di cabang lain.' });
  if (visit.rows[0].doctor_id && visit.rows[0].doctor_id !== doctor.rows[0].id) {
    return res.status(403).json({ message: 'Pasien ini terdaftar ke dokter lain.' });
  }

  const q = await pool.query(
    `INSERT INTO medical_documents(visit_id, doctor_id, document_type, title, content, rest_start_date, rest_end_date, status, destination)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'WAITING_ADMIN','ADMIN') RETURNING *`,
    [visitId, doctor.rows[0].id, parsed.data.documentType, parsed.data.title, parsed.data.content, parsed.data.restStartDate ?? null, parsed.data.restEndDate ?? null]
  );
  res.status(201).json(q.rows[0]);
});
