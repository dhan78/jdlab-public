import { describe, it, expect } from 'vitest'
import { serializeForDelivery } from '../lib/telemetry-sink'

// The guarded boundary: on the Firehose/Parquet delivery path, `props` (a
// variable-shaped object) is serialized to a JSON string so it maps to the fixed
// `props string` Glue column. Dev NDJSON keeps `props` as an object (not tested
// here — that path never calls serializeForDelivery).
describe('serializeForDelivery (props boundary)', () => {
  it('stringifies an object props to JSON', () => {
    const out = serializeForDelivery({ ev: 'case_open', props: { caseId: 42, open: true } }) as {
      ev: string
      props: unknown
    }
    expect(out.ev).toBe('case_open')
    expect(typeof out.props).toBe('string')
    expect(JSON.parse(out.props as string)).toEqual({ caseId: 42, open: true })
  })

  it('maps undefined props to explicit null', () => {
    const out = serializeForDelivery({ ev: 'ping', props: undefined }) as { props: unknown }
    expect(out.props).toBeNull()
  })

  it('maps a missing props key to null-free passthrough', () => {
    const out = serializeForDelivery({ ev: 'ping' }) as Record<string, unknown>
    expect('props' in out).toBe(false)
  })

  it('leaves an already-string props untouched (idempotent)', () => {
    const out = serializeForDelivery({ ev: 'x', props: '{"a":1}' }) as { props: unknown }
    expect(out.props).toBe('{"a":1}')
  })

  it('does not mutate the original record', () => {
    const rec = { ev: 'case_open', props: { caseId: 7 } }
    serializeForDelivery(rec)
    expect(typeof rec.props).toBe('object')
    expect(rec.props).toEqual({ caseId: 7 })
  })

  it('passes through non-object inputs', () => {
    expect(serializeForDelivery(null)).toBeNull()
    expect(serializeForDelivery('str')).toBe('str')
  })
})
