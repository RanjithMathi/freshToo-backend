// One-off script to create the users table.
// Run with: node db/init.js
import { pool, query } from './pool.js';

async function init() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  console.log('✅ users table ready');
  await pool.end();
}

init().catch((err) => {
  console.error('Init failed:', err);
  process.exit(1);
});
