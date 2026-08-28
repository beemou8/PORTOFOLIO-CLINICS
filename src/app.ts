import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import 'dotenv/config';
import { pool } from './config/db.js';
import { authRouter } from './routes/auth.js';
import { hrRouter } from './routes/hr.js';
import { doctorsRouter } from './routes/doctors.js';
import { patientsRouter } from './routes/patients.js';
import { visitsRouter } from './routes/visits.js';
import { prescriptionsRouter } from './routes/prescriptions.js';
import { pharmacyRouter } from './routes/pharmacy.js';
import { financeRouter } from './routes/finance.js';
import { adminRouter } from './routes/admin.js';
import { verificationRouter } from './routes/verification.js';
import { branchesRouter } from './routes/branches.js';
import { settingsRouter } from './routes/settings.js';
import { dashboardRouter } from './routes/dashboard.js';
import { generalRateLimiter, loginRateLimiter, verificationRateLimiter } from './middleware/rateLimit.js';
import { ensureUploadRoot, UPLOAD_ROOT } from './lib/localUploads.js';

const app = express();

// Security headers (CSP dimatikan default helmet karena API ini JSON-only, bukan penyaji halaman HTML).
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: di production hanya origin yang terdaftar di env CORS_ORIGIN (pisahkan koma
// untuk multi-domain) yang boleh memanggil API. Di luar production (dev di laptop/lokal),
// origin apa pun diizinkan supaya tidak terhambat oleh localhost vs 127.0.0.1 vs IP LAN.
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!isProduction) return callback(null, true);
    // origin kosong = request non-browser (curl, health check, dsb), tetap diizinkan.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origin tidak diizinkan oleh CORS'));
  },
}));

app.use(express.json({ limit: '8mb' }));
// Foto disimpan sebagai file lokal di UPLOAD_DIR (default: ./uploads) dan hanya URL relatifnya yang masuk database.
app.use('/uploads', (_req, res, next) => {
  // Frontend dev biasanya beda origin (5173 -> 3000), jadi foto lokal harus boleh dipakai sebagai resource lintas origin.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(UPLOAD_ROOT, { index: false, fallthrough: true, maxAge: isProduction ? '1d' : 0 }));

// Pagar rate-limit terluar untuk seluruh API.
app.use('/api', generalRateLimiter);

app.get('/health', async (_req, res) => {
  const q = await pool.query('SELECT NOW() AS now');
  res.json({ ok: true, databaseTime: q.rows[0].now });
});

app.use('/api/auth/login', loginRateLimiter);
app.use('/api/verification', verificationRateLimiter);

app.use('/api/auth', authRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/hr', hrRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/visits', visitsRouter);
app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/pharmacy', pharmacyRouter);
app.use('/api/finance', financeRouter);
app.use('/api/admin', adminRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/dashboard', dashboardRouter);

// Serve frontend React yang sudah di-build (web/dist)
const webDistPath = path.resolve(process.cwd(), 'web/dist');
app.use(express.static(webDistPath));

// SPA fallback: semua route selain /api dan /uploads diarahkan ke index.html
app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
  res.sendFile(path.join(webDistPath, 'index.html'));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err instanceof Error ? err.message : 'Internal server error' });
});

const port = Number(process.env.PORT ?? 3000);
await ensureUploadRoot();
app.listen(port, () => {
  console.log(`BIM CLINICS API berjalan di http://localhost:${port}`);
  console.log('Penyimpanan foto: local filesystem (URL /uploads/...)');
});