import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the S3 client the ingest Lambda uses, so the test touches no AWS.
// vi.hoisted keeps the spy reachable inside the (hoisted) vi.mock factory.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = sendMock
  },
  HeadObjectCommand: class {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  },
}))

// The handler reads its config from env at module load — set it before importing.
process.env.PORTAL_BASE_URL = 'https://portal.test'
process.env.INGEST_API_TOKEN = 'test-token'

// Variable specifier so `tsc --noEmit` doesn't try to type the untyped .mjs.
const handlerPath = '../lambda/ingest-case.mjs'
const { handler } = (await import(handlerPath)) as {
  handler: (event: unknown) => Promise<{ batchItemFailures: { itemIdentifier: string }[] }>
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

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => ({
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => sendMock.mockReset())
afterEach(() => vi.unstubAllGlobals())

describe('ingest-case Lambda handler', () => {
  it('creates a case for a model scan and posts the right payload', async () => {
    sendMock.mockResolvedValue({
      Metadata: { 'doctor-email': 'dr@x.com', title: 'Crown #14', 'tooth-ref': '14', 'case-type': 'crown' },
      ETag: '"etag123"',
      ContentLength: 42,
    })
    const fetchMock = stubFetch(200, { caseId: 'DL-1', created: true })

    const res = await handler(ebEvent('scans/raw/lindqvist/scan.stl'))

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
    const fetchMock = stubFetch(200, {})
    const res = await handler(ebEvent('scans/raw/notes.txt'))
    expect(res).toEqual({ batchItemFailures: [] })
    expect(sendMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a batch-item failure when the portal rejects an unmapped practice (409)', async () => {
    sendMock.mockResolvedValue({ Metadata: {}, ETag: '"etag123"', ContentLength: 10 })
    stubFetch(409, { error: 'Unmapped practice' })
    const event = {
      Records: [{ messageId: 'msg-1', body: JSON.stringify(ebEvent('scans/raw/acme/upper.stl')) }],
    }
    const res = await handler(event)
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }])
  })
})
