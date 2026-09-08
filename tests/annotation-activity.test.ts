import { describe, it, expect } from 'vitest'
import {
  buildAnnotationActivity,
  normalizeKind,
  nounFor,
} from '../lib/annotation-activity'

// Pure logic behind the thread "annotation activity" entry. No auth/DB, so we
// test the summary + meta shaping directly (the route just wraps this).

describe('normalizeKind', () => {
  it('maps to the three known kinds and defaults unknown to pin', () => {
    expect(normalizeKind('measure')).toBe('measure')
    expect(normalizeKind('mixed')).toBe('mixed')
    expect(normalizeKind('pin')).toBe('pin')
    expect(normalizeKind('nonsense')).toBe('pin')
    expect(normalizeKind(undefined)).toBe('pin')
  })
})

describe('nounFor', () => {
  it('uses the right clinical noun per kind', () => {
    expect(nounFor('pin')).toBe('pin')
    expect(nounFor('measure')).toBe('measurement')
    expect(nounFor('mixed')).toBe('annotation')
  })
})

describe('buildAnnotationActivity', () => {
  it('quotes the note inline for a single pin', () => {
    const { summary, meta } = buildAnnotationActivity({
      attachmentId: 'a1',
      modelName: 'lower-jaw',
      annotationIds: ['1'],
      notes: ['margin short distal'],
      kind: 'pin',
    })
    expect(summary).toBe('Added a pin to lower-jaw: \u201cmargin short distal\u201d')
    expect(meta.count).toBe(1)
    expect(meta.notes).toEqual(['margin short distal'])
    expect(meta.attachmentId).toBe('a1')
    expect(meta.previewKey).toBeNull()
  })

  it('summarizes multiple pins with a count (notes carried in meta for the UI)', () => {
    const { summary, meta } = buildAnnotationActivity({
      previewKey: 'p1',
      modelName: 'upper-jaw',
      annotationIds: ['1', '2', '3'],
      notes: ['a', 'b', 'c'],
      kind: 'pin',
    })
    expect(summary).toBe('Added 3 pins to upper-jaw')
    expect(meta.count).toBe(3)
    expect(meta.notes).toEqual(['a', 'b', 'c'])
    expect(meta.previewKey).toBe('p1')
    expect(meta.attachmentId).toBeNull()
  })

  it('uses the measurement noun and never quotes (measures usually have no note)', () => {
    const { summary } = buildAnnotationActivity({
      attachmentId: 'a1',
      modelName: 'occlusion',
      annotationIds: ['1'],
      notes: [],
      kind: 'measure',
    })
    expect(summary).toBe('Added a measurement to occlusion')
  })

  it('falls back to "the scan" when no model name is given', () => {
    const { summary, meta } = buildAnnotationActivity({
      attachmentId: 'a1',
      annotationIds: ['1'],
      kind: 'pin',
    })
    expect(summary).toBe('Added a pin to the scan')
    expect(meta.modelName).toBe('the scan')
  })

  it('trims blank notes and caps note length at 500', () => {
    const long = 'x'.repeat(600)
    const { meta } = buildAnnotationActivity({
      attachmentId: 'a1',
      modelName: 'm',
      annotationIds: ['1', '2'],
      notes: ['  keep  ', '   ', long],
      kind: 'pin',
    })
    // blank dropped, whitespace trimmed, long note truncated to 500
    expect(meta.notes).toEqual(['keep', 'x'.repeat(500)])
  })

  it('reports count 0 for an empty batch so the route can reject it', () => {
    const { meta } = buildAnnotationActivity({ attachmentId: 'a1', annotationIds: [], kind: 'pin' })
    expect(meta.count).toBe(0)
  })
})
