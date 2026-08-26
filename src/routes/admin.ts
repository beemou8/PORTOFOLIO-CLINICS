import { Router } from 'express';
import { pool } from '../config/db.js';
import QRCode from 'qrcode';
import { allowRoles, requireAuth } from '../middleware/auth.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, allowRoles('ADMIN'));

adminRouter.get('/documents', async (req, res) => {
  const status = String(req.query.status ?? 'WAITING_ADMIN');
  const q = await pool.query(
    `SELECT md.*, p.full_name AS patient_name, e.full_name AS doctor_name,
            v.registration_no, v.visit_date
     FROM medical_documents md
     JOIN visits v ON v.id = md.visit_id
     JOIN patients p ON p.id = v.patient_id
     JOIN doctor_profiles dp ON dp.id = md.doctor_id
     JOIN employees e ON e.id = dp.employee_id
     WHERE md.status = $1
     ORDER BY md.created_at`,
    [status]
  );
  res.json(q.rows);
});

adminRouter.post('/documents/:id/process', async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? 'PROCESSED');
  if (!['PROCESSED', 'PRINTED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ message: 'Status dokumen tidak valid' });
  }
  const q = await pool.query(
    `UPDATE medical_documents
     SET status = $2, processed_by = $3, processed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status, req.user!.employeeId]
  );
  if (!q.rowCount) return res.status(404).json({ message: 'Dokumen tidak ditemukan' });
  res.json(q.rows[0]);
});


adminRouter.get('/documents/:id/print-data', async (req, res) => {
  const id = Number(req.params.id);
  const q = await pool.query(
    `SELECT md.*, p.full_name AS patient_name, p.medical_record_no,
            e.full_name AS doctor_name, dp.specialization, dp.sip_number,
            v.registration_no, v.visit_date, b.name AS branch_name, b.address AS branch_address, b.phone AS branch_phone
     FROM medical_documents md
     JOIN visits v ON v.id = md.visit_id
     JOIN patients p ON p.id = v.patient_id
     JOIN doctor_profiles dp ON dp.id = md.doctor_id
     JOIN employees e ON e.id = dp.employee_id
     LEFT JOIN branches b ON b.id = v.branch_id
     WHERE md.id = $1`,
    [id]
  );
  if (!q.rowCount) return res.status(404).json({ message: 'Dokumen tidak ditemukan' });

  const d = q.rows[0];
  const webUrl = (process.env.PUBLIC_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
  const verificationUrl = `${webUrl}/verify/${d.verification_token}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 320, margin: 1 });

  res.json({ ...d, verification_url: verificationUrl, qr_data_url: qrDataUrl });
});
