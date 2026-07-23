/**
 * Set (or reset) the portal admin password WITHOUT re-seeding.
 *
 * The admin password is stored HASHED in users.password_hash. The seed only
 * sets it on FIRST creation (getOrCreateUser is idempotent), so changing
 * PORTAL_ADMIN_PASSWORD in .env.local later has no effect. This script hashes a
 * new password and upserts the admin row directly.
 *
 * Targets whatever DATABASE_URL in .env.local points at (local DB or the SSM
 * tunnel to prod) — so double-check where you're pointed before running.
 *
 * Usage:
 *   npm run db:set-admin-password -- 'NewSecurePass123'     # explicit password
 *   npm run db:set-admin-password                            # uses PORTAL_ADMIN_PASSWORD
 *   npm run db:set-admin-password -- --email a@b.com 'Pass'  # target a specific email
 */
import { eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import { hashPassword } from '../lib/portal-auth'

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  // Password = first positional (non-flag) arg, else PORTAL_ADMIN_PASSWORD.
  const positional = process.argv.slice(2).find((a, idx, all) => {
    if (a.startsWith('--')) return false
    // skip a value that belongs to a preceding --flag (e.g. --email a@b.com)
    return !(idx > 0 && all[idx - 1].startsWith('--'))
  })
  const password = positional ?? process.env.PORTAL_ADMIN_PASSWORD
  const email = flag('email') ?? process.env.PORTAL_ADMIN_EMAIL ?? 'admin@jdlab.us'

  if (!password) {
    console.error('ERROR: provide a password arg or set PORTAL_ADMIN_PASSWORD in .env.local')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('ERROR: password must be at least 8 characters')
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)
  const existing = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing[0]) {
    await db.update(users).set({ passwordHash }).where(eq(users.email, email))
    console.log(`updated password for existing user: ${email} (role: ${existing[0].role})`)
  } else {
    await db.insert(users).values({ name: 'Admin', email, passwordHash, role: 'admin' })
    console.log(`created new admin: ${email}`)
  }
  process.exit(0)
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
