import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// A single shared connection pool. Pool is lazy — it doesn't connect until the
// first query — so importing this module during `next build` is safe even if
// DATABASE_URL isn't set at build time.
const globalForDb = globalThis as unknown as { __pgPool?: Pool }

const pool =
  globalForDb.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__pgPool = pool
}

export const db = drizzle(pool, { schema })
export { schema }
