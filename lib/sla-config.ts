/**
 * Server-side SLA turnaround config (admin-editable). Reads/writes the
 * sla_config table and merges it over the code defaults in lib/sla.ts.
 * Kept separate from lib/sla.ts so the pure/compute helpers stay client-safe.
 */
import { db } from './db'
import { slaConfig } from './db/schema'
import { SLA_STANDARD_DAYS, type SlaConfigMap } from './sla'
import { CASE_TYPES, type CaseType } from './case-meta'

export interface SlaSetting {
  caseType: CaseType
  standardDays: number
  rushDays: number
}

// Raw override map (only rows present in the table) for computeSla.
export async function getSlaConfigMap(): Promise<SlaConfigMap> {
  const rows = await db.select().from(slaConfig)
  const map: SlaConfigMap = {}
  for (const r of rows) {
    map[r.caseType as CaseType] = { standardDays: r.standardDays, rushDays: r.rushDays }
  }
  return map
}

// Fully-resolved settings for every case type (DB over code defaults) — for the admin UI.
export async function getSlaSettings(): Promise<SlaSetting[]> {
  const map = await getSlaConfigMap()
  return CASE_TYPES.map(ct => {
    const std = SLA_STANDARD_DAYS[ct] ?? 3
    return {
      caseType: ct,
      standardDays: map[ct]?.standardDays ?? std,
      rushDays: map[ct]?.rushDays ?? Math.max(1, std - 1),
    }
  })
}

// Upsert one case type's turnaround. Values are clamped to a sane range.
export async function setSlaSetting(caseType: CaseType, standardDays: number, rushDays: number): Promise<void> {
  const std = Math.min(60, Math.max(1, Math.round(standardDays)))
  const rush = Math.min(std, Math.max(1, Math.round(rushDays)))
  await db
    .insert(slaConfig)
    .values({ caseType, standardDays: std, rushDays: rush, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: slaConfig.caseType,
      set: { standardDays: std, rushDays: rush, updatedAt: new Date() },
    })
}
