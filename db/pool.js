import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check your .env file.');
}

// Persistent connection pool, shared across the app.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Small helper so routes don't have to manually connect/release every time.
export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
