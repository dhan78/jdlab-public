/**
 * Generic runtime key/value settings backed by the `app_settings` table.
 * These are read on each request (no caching), so an admin can flip a flag and
 * have it take effect immediately — no redeploy, no server restart. Keep values
 * small and string-typed; callers coerce.
 */
import { db } from './db'
import { appSettings } from './db/schema'
import { eq, like } from 'drizzle-orm'

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1)
  return rows[0]?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    })
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key))
}

// All settings whose key starts with `prefix`, as a [key, value] list.
export async function listSettings(prefix: string): Promise<Array<{ key: string; value: string }>> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(like(appSettings.key, `${prefix}%`))
  return rows.map(r => ({ key: r.key, value: r.value }))
}
