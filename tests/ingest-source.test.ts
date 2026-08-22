import { describe, it, expect } from 'vitest'
import {
  scanRawKeyFromExternalId,
  isAllowedCopySource,
  DEFAULT_SCAN_RAW_PREFIX,
} from '../lib/ingest-source'

describe('scanRawKeyFromExternalId', () => {
  it('recovers the key from an s3 externalId under the raw prefix', () => {
    expect(scanRawKeyFromExternalId('s3:scans/raw/lindqvist/upper.zip:abc123')).toBe(
      'scans/raw/lindqvist/upper.zip'
    )
  })

  it('handles keys with no etag segment', () => {
    expect(scanRawKeyFromExternalId('s3:scans/raw/x.stl')).toBe('scans/raw/x.stl')
  })

  it('rejects keys outside the raw prefix', () => {
    expect(scanRawKeyFromExternalId('s3:intake/lindqvist/x.stl:etag')).toBeNull()
    expect(scanRawKeyFromExternalId('s3:scans/glb/x.glb:etag')).toBeNull()
  })

  it('rejects non-s3 externalIds and empty input', () => {
    expect(scanRawKeyFromExternalId('local:foo.stl')).toBeNull()
    expect(scanRawKeyFromExternalId('')).toBeNull()
    expect(scanRawKeyFromExternalId(null)).toBeNull()
    expect(scanRawKeyFromExternalId(undefined)).toBeNull()
  })

  it('honors a custom raw prefix', () => {
    expect(scanRawKeyFromExternalId('s3:intake/x.stl:etag', 'intake/')).toBe('intake/x.stl')
    expect(scanRawKeyFromExternalId('s3:scans/raw/x.stl:etag', 'intake/')).toBeNull()
  })

  it('defaults the prefix to scans/raw/', () => {
    expect(DEFAULT_SCAN_RAW_PREFIX).toBe('scans/raw/')
  })
})

describe('isAllowedCopySource', () => {
  const bucket = 'jdlab-scans-prod-use1'
  const prefix = 'scans/raw/'

  it('allows the configured bucket + raw prefix', () => {
    expect(isAllowedCopySource(bucket, 'scans/raw/lindqvist/x.zip', bucket, prefix)).toBe(true)
  })

  it('rejects a different bucket', () => {
    expect(isAllowedCopySource('other-bucket', 'scans/raw/x.zip', bucket, prefix)).toBe(false)
  })

  it('rejects a key outside the raw prefix', () => {
    expect(isAllowedCopySource(bucket, 'scans/glb/x.glb', bucket, prefix)).toBe(false)
    expect(isAllowedCopySource(bucket, 'case-attachments/x', bucket, prefix)).toBe(false)
  })

  it('rejects when no bucket is configured', () => {
    expect(isAllowedCopySource(bucket, 'scans/raw/x.zip', undefined, prefix)).toBe(false)
    expect(isAllowedCopySource(bucket, 'scans/raw/x.zip', '', prefix)).toBe(false)
  })
})
