import { describe, it, expect, vi } from 'vitest'

// The handler takes injectable deps ({ s3, fetch }) as a 3rd arg, so tests pass
// fakes directly — NO vi.mock, no @aws-sdk interception, no vitest.config inlining.
// Env-independent: it cannot regress to hitting real S3 on any platform/branch.
process.env.PORTAL_BASE_URL = 'https://portal.test'
process.env.INGEST_API_TOKEN = 'test-token'

// Variable specifier so `tsc --noEmit` doesn't try to type the untyped .mjs.
const handlerPath = '../lambda/ingest-case.mjs'
type Deps = { s3: { send: (cmd: unknown) => Promise<unknown> }; fetch: typeof fetch }
const { handler } = (await import(handlerPath)) as {
  handler: (
    event: unknown,
    context?: unknown,
    deps?: Deps,
  ) => Promise<{ batchItemFailures: { itemIdentifier: string }[] }>
}

type FetchCall = [string, { headers: Record<string, string>; body: string }]

// An S3 "Object Created" event as delivered through EventBridge.
function ebEvent(key: string) {
  return {
    'detail-type': 'Object Created',
    source: 'aws.s3',
    detail: { bucket: { name: 'scan-bkt' }, object: { key, etag: 'etag123', size: 42 } },
  }
}

// Fake S3 whose HeadObject `.send()` resolves to the given metadata.
function fakeS3(head?: unknown) {
  return { send: vi.fn(async () => head ?? {}) }
}

// Fake fetch returning the given status/body (matches the handler's usage).
function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }))
}

describe('ingest-case Lambda handler', () => {
  it('creates a case for a model scan and posts the right payload', async () => {
    const s3 = fakeS3({
      Metadata: { 'doctor-email': 'dr@x.com', title: 'Crown #14', 'tooth-ref': '14', 'case-type': 'crown' },
      ETag: '"etag123"',
      ContentLength: 42,
    })
    const fetchMock = fakeFetch(200, { caseId: 'DL-1', created: true })

    const res = await handler(ebEvent('scans/raw/lindqvist/scan.stl'), null, { s3, fetch: fetchMock as unknown as typeof fetch })

    expect(res).toEqual({ batchItemFailures: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0] as unknown as FetchCall
    expect(url).toBe('https://portal.test/api/ingest/cases')
    expect(opts.headers.Authorization).toBe('Bearer test-token')
    const payload = JSON.parse(opts.body)
    expect(payload.externalId).toBe('s3:scans/raw/lindqvist/scan.stl:etag123')
    expect(payload.doctorEmail).toBe('dr@x.com')
    expect(payload.practiceKey).toBe('lindqvist')
    expect(payload.caseType).toBe('crown')
    expect(payload.attachment.copyFrom).toEqual({
      sourceBucket: 'scan-bkt',
      sourceKey: 'scans/raw/lindqvist/scan.stl',
    })
  })

  it('skips a non-model key without a HEAD or POST', async () => {
    const s3 = fakeS3()
    const fetchMock = fakeFetch(200, {})
    const res = await handler(ebEvent('scans/raw/notes.txt'), null, { s3, fetch: fetchMock as unknown as typeof fetch })
    expect(res).toEqual({ batchItemFailures: [] })
    expect(s3.send).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a batch-item failure when the portal rejects an unmapped practice (409)', async () => {
    const s3 = fakeS3({ Metadata: {}, ETag: '"etag123"', ContentLength: 10 })
    const fetchMock = fakeFetch(409, { error: 'Unmapped practice' })
    const event = {
      Records: [{ messageId: 'msg-1', body: JSON.stringify(ebEvent('scans/raw/acme/upper.stl')) }],
    }
    const res = await handler(event, null, { s3, fetch: fetchMock as unknown as typeof fetch })
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }])
  })
})
