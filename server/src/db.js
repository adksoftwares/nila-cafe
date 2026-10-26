import 'dotenv/config';
import pg from 'pg';

export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const demoMode = !pool;

/**
 * Scoped database query executor with PostgreSQL Row-Level Security (RLS) context
 */
export async function query(sql, args = [], user = null) {
  if (!pool) throw new Error('Database is not configured');
  if (!user) {
    return (await pool.query(sql, args)).rows;
  }

  // Scoped query with PostgreSQL Row-Level Security (RLS) session parameters
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (user.role === 'admin') {
      await client.query("SELECT set_config('app.is_admin', 'true', true)");
    } else if (user.shop_id) {
      await client.query("SELECT set_config('app.current_shop_id', $1, true)", [user.shop_id]);
    }
    const res = await client.query(sql, args);
    await client.query('COMMIT');
    return res.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
