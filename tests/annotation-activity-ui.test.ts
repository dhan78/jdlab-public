import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Source-level guards for the annotation-activity feature (batched thread entry
// + "View on scan" deep-link) and the /demo wiring. vitest runs in node with no
// DOM, so — like viewer-layout.test.ts — we assert the invariants against source.

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const thread = read('../components/CaseThread.tsx')
const demo = read('../components/DemoCaseView.tsx')

describe('CaseThread annotation-activity wiring', () => {
  it('renders a distinct system entry for kind === "annotation" (not a chat bubble)', () => {
    expect(thread).toMatch(/m\.kind === 'annotation'/)
  })

  it('exposes a "View on scan" deep-link that opens the target model', () => {
    expect(thread).toContain('data-intent="annotation_view_on_scan"')
    expect(thread).toContain('openAnnotationTarget(m.meta)')
  })

  it('batches pins into one summary posted to the annotation-activity endpoint', () => {
    expect(thread).toContain('/annotation-activity')
    expect(thread).toMatch(/setTimeout\(\(\) => \{ void flushActivity\(false\) \}, 12_000\)/)
  })

  it('flushes buffered activity on unmount/case-switch with keepalive so it is not lost', () => {
    expect(thread).toContain('keepalive: true')
    expect(thread).toContain('void flushActivity(true)')
  })

  it('shows note text: single-pin inline and multi-pin "+N more"', () => {
    expect(thread).toMatch(/\+\{notes\.length - 1\} more/)
  })
})

describe('DemoCaseView navigation + CTA', () => {
  it('links the banner logo back to the landing page', () => {
    expect(demo).toContain('import Logo')
    expect(demo).toMatch(/<Link\s+href="\/"/)
    expect(demo).toContain('<Logo')
  })

  it('points the CTA at the on-page pilot form, not the landing-page contact form', () => {
    expect(demo).toContain('href="#request-pilot"')
    expect(demo).not.toContain('href="/#contact"')
  })
})
