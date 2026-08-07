import { describe, it, expect, beforeEach, vi } from 'vitest'

// Back the DB-backed settings layer with an in-memory store so demo-config can
// be tested without a database. `vi.hoisted` makes `store` available to the
// (hoisted) vi.mock factory below.
const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }))

vi.mock('../lib/app-settings', () => ({
  getSetting: async (key: string) => store.get(key) ?? null,
  setSetting: async (key: string, value: string) => {
    store.set(key, value)
  },
}))

import {
  isDemoEnabled,
  getDemoCaseId,
  setDemoEnabled,
  setDemoCaseId,
  getDemoConfig,
} from '../lib/demo-config'

beforeEach(() => {
  store.clear()
  delete process.env.DEMO_CASE_ID
})

describe('demo-config kill-switch', () => {
  it('is OFF by default (no setting present)', async () => {
    expect(await isDemoEnabled()).toBe(false)
  })

  it('toggles enabled via the DB-backed flag', async () => {
    await setDemoEnabled(true)
    expect(await isDemoEnabled()).toBe(true)
    await setDemoEnabled(false)
    expect(await isDemoEnabled()).toBe(false)
  })

  it('treats any non-"true" value as disabled (only the exact string enables)', async () => {
    store.set('demo.enabled', 'yes')
    expect(await isDemoEnabled()).toBe(false)
    store.set('demo.enabled', '1')
    expect(await isDemoEnabled()).toBe(false)
    store.set('demo.enabled', 'TRUE')
    expect(await isDemoEnabled()).toBe(false)
  })

  it('enabled is DB-only — the DEMO_CASE_ID env var never turns the demo on', async () => {
    process.env.DEMO_CASE_ID = 'ENVCASE1'
    expect(await isDemoEnabled()).toBe(false)
  })
})

describe('demo-config target case', () => {
  it('returns null when neither DB nor env provides a case id', async () => {
    expect(await getDemoCaseId()).toBeNull()
  })

  it('stores and returns the demo case id, trimmed', async () => {
    await setDemoCaseId('  152XJTP  ')
    expect(await getDemoCaseId()).toBe('152XJTP')
  })

  it('falls back to DEMO_CASE_ID env when there is no DB value', async () => {
    process.env.DEMO_CASE_ID = 'ENVCASE1'
    expect(await getDemoCaseId()).toBe('ENVCASE1')
  })

  it('lets the DB value win over the env fallback', async () => {
    process.env.DEMO_CASE_ID = 'ENVCASE1'
    await setDemoCaseId('DBCASE9')
    expect(await getDemoCaseId()).toBe('DBCASE9')
  })
})

describe('demo-config aggregate', () => {
  it('getDemoConfig reports both enabled and caseId', async () => {
    await setDemoEnabled(true)
    await setDemoCaseId('ABC1234')
    expect(await getDemoConfig()).toEqual({ enabled: true, caseId: 'ABC1234' })
  })

  it('getDemoConfig defaults to disabled with no case', async () => {
    expect(await getDemoConfig()).toEqual({ enabled: false, caseId: null })
  })
})
