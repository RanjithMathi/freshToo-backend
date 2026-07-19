// Creates the first super_admin account so you can log in and create others via the API.
// Run with: npm run db:seed
// Change these before running, or set via env vars.
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool, query } from './pool.js';

dotenv.config();

const SEED_NAME = process.env.SEED_ADMIN_NAME || 'Super Admin';
const SEED_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@chickendelivery.com';
const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

async function seed() {
  const existing = await query('SELECT id FROM admins WHERE email = $1', [SEED_EMAIL]);
  if (existing.rows.length > 0) {
    console.log(`Admin ${SEED_EMAIL} already exists, skipping.`);
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  await query(
    `INSERT INTO admins (name, email, password_hash, role) VALUES ($1, $2, $3, 'super_admin')`,
    [SEED_NAME, SEED_EMAIL, passwordHash]
  );

  console.log('✅ Super admin created:');
  console.log(`   email: ${SEED_EMAIL}`);
  console.log(`   password: ${SEED_PASSWORD}`);
  console.log('⚠️  Log in and change this password immediately.');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
