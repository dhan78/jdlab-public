/**
 * Public read-only "demo case" configuration + runtime kill-switch.
 *
 * The demo surface (`/demo`) lets a prospect — e.g. a dentist scanning a QR at
 * a meetup — open ONE curated, anonymized case read-only, with no login and no
 * write access, so they can experience the annotated 3D scan viewer.
 *
 * SECURITY MODEL
 *  - OFF by default. `demo.enabled` must be explicitly set to 'true'.
 *  - Runtime kill-switch: the flag lives in the DB (app_settings) and is read on
 *    every request, so an admin can turn the demo OFF instantly (no redeploy) if
 *    the link is abused. When off, `/demo` returns 404.
 *  - Exposes EXACTLY one case id (`demo.caseId`). There is no case enumeration,
 *    no other-case navigation, and no mutation endpoint on the demo path, so a
 *    bad actor can at most view the single case the admin chose to publish.
 *  - Choose an ANONYMIZED case as the demo target (no real PHI).
 *
 * `DEMO_CASE_ID` env var only seeds a default target; the DB value wins and the
 * enabled flag is DB-only (env can't force the demo on in prod).
 */
import { getSetting, setSetting } from './app-settings'

const KEY_ENABLED = 'demo.enabled'
const KEY_CASE_ID = 'demo.caseId'

export async function isDemoEnabled(): Promise<boolean> {
  return (await getSetting(KEY_ENABLED)) === 'true'
}

export async function getDemoCaseId(): Promise<string | null> {
  const fromDb = await getSetting(KEY_CASE_ID)
  return (fromDb && fromDb.trim()) || process.env.DEMO_CASE_ID || null
}

export async function setDemoEnabled(enabled: boolean): Promise<void> {
  await setSetting(KEY_ENABLED, enabled ? 'true' : 'false')
}

export async function setDemoCaseId(caseId: string): Promise<void> {
  await setSetting(KEY_CASE_ID, caseId.trim())
}

export interface DemoConfig {
  enabled: boolean
  caseId: string | null
}

export async function getDemoConfig(): Promise<DemoConfig> {
  const [enabled, caseId] = await Promise.all([isDemoEnabled(), getDemoCaseId()])
  return { enabled, caseId }
}
