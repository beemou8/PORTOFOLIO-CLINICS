import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../config/db.js';
import 'dotenv/config';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Input tidak valid' });

  const { username, password } = parsed.data;
  const q = await pool.query(
    `SELECT ua.id AS user_id, ua.employee_id, ua.username, ua.password_hash,
            e.full_name, e.branch_id, b.code AS branch_code, b.name AS branch_name,
            COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
     FROM user_accounts ua
     JOIN employees e ON e.id = ua.employee_id
     LEFT JOIN branches b ON b.id = e.branch_id
     LEFT JOIN user_roles ur ON ur.user_id = ua.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE ua.username = $1 AND ua.is_active = TRUE AND e.is_active = TRUE
     GROUP BY ua.id, e.id, b.id`,
    [username]
  );

  if (!q.rowCount) return res.status(401).json({ message: 'Username/password salah' });
  const user = q.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Username/password salah' });

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET belum diisi');

  const userId = Number(user.user_id);
  const employeeId = Number(user.employee_id);
  const branchId = user.branch_id == null ? null : Number(user.branch_id);

  const token = jwt.sign(
    {
      userId,
      employeeId,
      username: user.username,
      roles: user.roles,
      branchId,
    },
    secret,
    { expiresIn: '12h' }
  );

  await pool.query('UPDATE user_accounts SET last_login_at = NOW() WHERE id = $1', [user.user_id]);

  res.json({
    token,
    user: {
      id: userId,
      employeeId,
      username: user.username,
      fullName: user.full_name,
      roles: user.roles,
      branchId,
      branchCode: user.branch_code,
      branchName: user.branch_name,
      allBranches: user.roles.includes('ADMIN'),
    },
  });
});
