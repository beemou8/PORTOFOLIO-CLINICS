import { Router } from 'express';
import { pool } from '../config/db.js';

export const verificationRouter = Router();

verificationRouter.get('/documents/:token', async (req, res) => {
  const token = String(req.params.token ?? '');
  const q = await pool.query(
    `SELECT md.document_no, md.document_type, md.title, md.status,
            md.rest_start_date, md.rest_end_date, md.created_at, md.processed_at,
            md.verification_enabled,
            v.registration_no, v.visit_date, v.status AS visit_status,
            p.full_name AS patient_name,
            e.full_name AS doctor_name, dp.specialization, dp.sip_number,
            b.name AS branch_name
     FROM medical_documents md
     JOIN visits v ON v.id = md.visit_id
     JOIN patients p ON p.id = v.patient_id
     JOIN doctor_profiles dp ON dp.id = md.doctor_id
     JOIN employees e ON e.id = dp.employee_id
     LEFT JOIN branches b ON b.id = v.branch_id
     WHERE md.verification_token::text = $1
     LIMIT 1`,
    [token]
  );

  if (!q.rowCount) {
    return res.status(404).json({
      valid: false,
      clinic: 'BIM CLINICS',
      message: 'Surat tidak ditemukan pada sistem BIM CLINICS.'
    });
  }

  const d = q.rows[0];
  const valid = Boolean(d.verification_enabled)
    && ['PROCESSED', 'PRINTED'].includes(d.status)
    && d.visit_status !== 'CANCELLED';

  return res.json({
    valid,
    clinic: 'BIM CLINICS',
    message: valid
      ? 'Surat terverifikasi dan kunjungan pasien tercatat di BIM CLINICS.'
      : 'Surat ditemukan, tetapi belum aktif, dibatalkan, atau belum disahkan administrasi.',
    document: {
      documentNo: d.document_no,
      type: d.document_type,
      title: d.title,
      status: d.status,
      issuedAt: d.processed_at ?? d.created_at,
      restStartDate: d.rest_start_date,
      restEndDate: d.rest_end_date
    },
    visit: {
      registrationNo: d.registration_no,
      visitDate: d.visit_date,
      patientName: d.patient_name,
      branchName: d.branch_name
    },
    doctor: {
      name: d.doctor_name,
      specialization: d.specialization,
      sipNumber: d.sip_number
    }
  });
});
