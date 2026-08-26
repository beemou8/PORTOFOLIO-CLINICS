import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { withTransaction, pool } from '../config/db.js';

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME ?? 'System Administrator';
const email = process.env.ADMIN_EMAIL ?? null;
const branchCode = process.env.ADMIN_BRANCH_CODE ?? 'MAIN';

if (!username || !password) {
  throw new Error('Isi ADMIN_USERNAME dan ADMIN_PASSWORD di .env');
}

await withTransaction(async (client) => {
  const branch = await client.query(
    `INSERT INTO branches(code, name, address, is_active)
     VALUES ($1, 'BIM CLINICS - Klinik Utama', 'Alamat klinik', TRUE)
     ON CONFLICT (code) DO UPDATE SET is_active = TRUE
     RETURNING id`,
    [branchCode]
  );
  const branchId = branch.rows[0].id;
  const hash = await bcrypt.hash(password, 12);

  const existing = await client.query(
    `SELECT ua.id AS user_id, ua.employee_id
     FROM user_accounts ua WHERE ua.username = $1`,
    [username]
  );

  let userId: number;
  if (existing.rowCount) {
    const row = existing.rows[0];
    await client.query(
      `UPDATE employees
       SET branch_id = $2, full_name = $3, employee_type = 'ADMIN', email = $4,
           is_active = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [row.employee_id, branchId, fullName, email]
    );
    await client.query(
      `UPDATE user_accounts
       SET password_hash = $2, is_active = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [row.user_id, hash]
    );
    userId = row.user_id;
  } else {
    const employeeCode = `ADM-${Date.now().toString().slice(-6)}`;
    const emp = await client.query(
      `INSERT INTO employees(branch_id, employee_code, full_name, employee_type, email, is_active)
       VALUES ($1,$2,$3,'ADMIN',$4,TRUE) RETURNING id`,
      [branchId, employeeCode, fullName, email]
    );
    const ua = await client.query(
      `INSERT INTO user_accounts(employee_id, username, password_hash, is_active)
       VALUES ($1,$2,$3,TRUE) RETURNING id`,
      [emp.rows[0].id, username, hash]
    );
    userId = ua.rows[0].id;
  }

  await client.query(
    `INSERT INTO user_roles(user_id, role_id)
     SELECT $1, id FROM roles WHERE code = 'ADMIN'
     ON CONFLICT DO NOTHING`,
    [userId]
  );
});

console.log(`Admin '${username}' berhasil dibuat/diupdate dan terhubung ke cabang '${branchCode}'.`);
await pool.end();
