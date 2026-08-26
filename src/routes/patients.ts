import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { isAdmin, userBranchId } from '../lib/branchAccess.js';

export const patientsRouter = Router();
patientsRouter.use(requireAuth);

const patientSchema = z.object({
  medicalRecordNo: z.string().optional(),
  nik: z.string().optional().nullable(),
  fullName: z.string().min(2),
  birthDate: z.string().optional().nullable(),
  gender: z.enum(['M', 'F']).optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

patientsRouter.get('/', async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const q = await pool.query(
    `SELECT * FROM patients
     WHERE ($1 = '' OR full_name ILIKE '%' || $1 || '%' OR medical_record_no ILIKE '%' || $1 || '%' OR COALESCE(nik,'') ILIKE '%' || $1 || '%')
     ORDER BY full_name LIMIT 100`,
    [search]
  );
  res.json(q.rows);
});

// Pencarian khusus riwayat pasien. Admin melihat semua, dokter/perawat hanya pasien
// yang pernah memiliki kunjungan pada cabang akunnya.
patientsRouter.get('/history-search', allowRoles('ADMIN', 'DOCTOR', 'NURSE'), async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const branchId = isAdmin(req) ? null : userBranchId(req);

  if (!isAdmin(req) && !branchId) {
    return res.status(403).json({ message: 'Cabang akun belum diatur.' });
  }

  const q = await pool.query(
    `SELECT p.id, p.medical_record_no, p.nik, p.full_name, p.birth_date, p.gender, p.phone,
            COUNT(v.id)::int AS total_visits,
            MAX(v.visit_date) AS last_visit_date
     FROM patients p
     JOIN visits v ON v.patient_id = p.id
     WHERE ($1 = '' OR p.full_name ILIKE '%' || $1 || '%' OR p.medical_record_no ILIKE '%' || $1 || '%' OR COALESCE(p.nik,'') ILIKE '%' || $1 || '%')
       AND ($2::bigint IS NULL OR v.branch_id = $2)
     GROUP BY p.id
     ORDER BY MAX(v.visit_date) DESC, p.full_name
     LIMIT 50`,
    [search, branchId]
  );
  res.json(q.rows);
});

patientsRouter.get('/:patientId/history', allowRoles('ADMIN', 'DOCTOR', 'NURSE'), async (req, res) => {
  const patientId = Number(req.params.patientId);
  if (!Number.isInteger(patientId) || patientId <= 0) {
    return res.status(400).json({ message: 'ID pasien tidak valid.' });
  }

  const patient = await pool.query(
    `SELECT id, medical_record_no, nik, full_name, birth_date, gender, phone, address, created_at
     FROM patients WHERE id = $1`,
    [patientId]
  );
  if (!patient.rowCount) return res.status(404).json({ message: 'Pasien tidak ditemukan.' });

  // Medical history adalah data sensitif. Admin boleh semua cabang. Dokter/perawat
  // baru boleh membuka riwayat bila pasien memang memiliki kunjungan di cabang mereka.
  if (!isAdmin(req)) {
    const branchId = userBranchId(req);
    if (!branchId) return res.status(403).json({ message: 'Cabang akun belum diatur.' });

    if (req.user!.roles.includes('DOCTOR')) {
      const doctor = await pool.query(
        `SELECT id FROM doctor_profiles WHERE employee_id = $1 AND is_active = TRUE`,
        [req.user!.employeeId]
      );
      if (!doctor.rowCount) return res.status(403).json({ message: 'Akun dokter tidak aktif.' });

      const access = await pool.query(
        `SELECT 1 FROM visits
         WHERE patient_id = $1 AND branch_id = $2 AND doctor_id = $3
         LIMIT 1`,
        [patientId, branchId, doctor.rows[0].id]
      );
      if (!access.rowCount) {
        return res.status(403).json({ message: 'Riwayat hanya dapat dibuka untuk pasien yang terdaftar ke dokter ini.' });
      }
    } else {
      const access = await pool.query(
        `SELECT 1 FROM visits WHERE patient_id = $1 AND branch_id = $2 LIMIT 1`,
        [patientId, branchId]
      );
      if (!access.rowCount) {
        return res.status(403).json({ message: 'Pasien tidak memiliki kunjungan pada cabang Anda.' });
      }
    }
  }

  const history = await pool.query(
    `SELECT
       v.id,
       v.registration_no,
       v.visit_date,
       v.created_at,
       v.complaint,
       v.status,
       b.id AS branch_id,
       b.name AS branch_name,
       e.full_name AS doctor_name,
       dp.specialization,
       mr.anamnesis,
       mr.diagnosis,
       mr.treatment_notes,
       mr.systolic,
       mr.diastolic,
       mr.temperature,
       mr.weight_kg,
       COALESCE(rx.medications, '[]'::json) AS medications
     FROM visits v
     JOIN branches b ON b.id = v.branch_id
     LEFT JOIN doctor_profiles dp ON dp.id = v.doctor_id
     LEFT JOIN employees e ON e.id = dp.employee_id
     LEFT JOIN medical_records mr ON mr.visit_id = v.id
     LEFT JOIN LATERAL (
       SELECT json_agg(
         json_build_object(
           'name', m.name,
           'qty', pi.qty,
           'unit', m.unit,
           'dosage', pi.dosage,
           'frequency', pi.frequency,
           'durationDays', pi.duration_days,
           'instruction', pi.instruction
         ) ORDER BY pi.id
       ) AS medications
       FROM prescriptions pr
       JOIN prescription_items pi ON pi.prescription_id = pr.id
       JOIN medications m ON m.id = pi.medication_id
       WHERE pr.visit_id = v.id AND pr.status <> 'CANCELLED'
     ) rx ON TRUE
     WHERE v.patient_id = $1
     ORDER BY v.visit_date DESC, v.created_at DESC`,
    [patientId]
  );

  const rows = history.rows;
  res.json({
    patient: patient.rows[0],
    stats: {
      totalVisits: rows.length,
      diagnosedVisits: rows.filter((r) => Boolean(r.diagnosis)).length,
      firstVisitDate: rows.length ? rows[rows.length - 1].visit_date : null,
      lastVisitDate: rows.length ? rows[0].visit_date : null,
    },
    history: rows,
  });
});

patientsRouter.post('/', async (req, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid', errors: parsed.error.flatten() });
  const d = parsed.data;

  // NIK menjadi identitas utama agar pasien yang datang kembali tetap memakai patient_id
  // yang sama. Ini membuat riwayat kunjungan tidak terpecah menjadi beberapa pasien.
  if (d.nik?.trim()) {
    const existing = await pool.query('SELECT * FROM patients WHERE nik = $1 LIMIT 1', [d.nik.trim()]);
    if (existing.rowCount) {
      return res.status(200).json({ ...existing.rows[0], is_existing: true });
    }
  }

  const mrn = d.medicalRecordNo ?? `RM-${Date.now()}`;
  const q = await pool.query(
    `INSERT INTO patients(medical_record_no, nik, full_name, birth_date, gender, phone, address)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [mrn, d.nik?.trim() || null, d.fullName, d.birthDate ?? null, d.gender ?? null, d.phone ?? null, d.address ?? null]
  );
  res.status(201).json({ ...q.rows[0], is_existing: false });
});
