import rateLimit from 'express-rate-limit';

// Login: batasi percobaan brute-force password per IP.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' },
});

// Verifikasi QR publik: batasi supaya token tidak bisa di-brute-force/scan besar-besaran.
export const verificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan verifikasi. Coba lagi beberapa menit lagi.' },
});

// Umum: pagar terluar untuk seluruh API supaya satu klien tidak bisa membanjiri server.
export const generalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
