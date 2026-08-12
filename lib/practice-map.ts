/**
 * Practice → doctor mapping for automated scan ingestion.
 *
 * A source (S3 prefix, drop folder, or later an iTero/DDX practice id) carries a
 * `practiceKey`; this maps it to the practice's portal doctor email, so incoming
 * scans auto-assign without tagging each file. Backed by app_settings
 * (key `practice.map.<practiceKey>` = doctor email), so it's admin-editable at
 * runtime with no migration. Unknown keys resolve to null → the ingest endpoint
 * rejects (worker quarantines) rather than guessing.
 */
import { getSetting, setSetting, deleteSetting, listSettings } from './app-settings'

const PREFIX = 'practice.map.'

const norm = (s: string) => s.trim().toLowerCase()

export async function resolvePracticeEmail(practiceKey: string): Promise<string | null> {
  if (!practiceKey) return null
  const v = await getSetting(PREFIX + norm(practiceKey))
  return v && v.trim() ? norm(v) : null
}

export async function setPracticeMapping(practiceKey: string, doctorEmail: string): Promise<void> {
  await setSetting(PREFIX + norm(practiceKey), norm(doctorEmail))
}

export async function deletePracticeMapping(practiceKey: string): Promise<void> {
  await deleteSetting(PREFIX + norm(practiceKey))
}

export interface PracticeMapping {
  practiceKey: string
  doctorEmail: string
}

export async function listPracticeMappings(): Promise<PracticeMapping[]> {
  const rows = await listSettings(PREFIX)
  return rows
    .map(r => ({ practiceKey: r.key.slice(PREFIX.length), doctorEmail: r.value }))
    .sort((a, b) => a.practiceKey.localeCompare(b.practiceKey))
}
