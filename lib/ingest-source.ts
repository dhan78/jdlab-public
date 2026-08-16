// Pure helpers for parsing/validating ingestion scan-source keys. No AWS/Next
// imports so they're cheap to unit-test and safe to share across routes.

export const DEFAULT_SCAN_RAW_PREFIX = 'scans/raw/'

/** Recover the S3 key from an ingestion externalId ("s3:<key>:<etag>"), but only
 *  if it lives under the raw-scan prefix. Returns null otherwise (e.g. a local:
 *  externalId, or a key outside the prefix). */
export function scanRawKeyFromExternalId(
  externalId: string | null | undefined,
  rawPrefix: string = DEFAULT_SCAN_RAW_PREFIX
): string | null {
  if (!externalId || !externalId.startsWith('s3:')) return null
  const rest = externalId.slice(3)
  const at = rest.lastIndexOf(':')
  const key = at > 0 ? rest.slice(0, at) : rest
  return key.startsWith(rawPrefix) ? key : null
}

/** Whether the ingestion token may copy this source object into the attachment
 *  space: it must be the configured scan bucket AND under the raw-scan prefix,
 *  so the token can't copy arbitrary S3 objects. */
export function isAllowedCopySource(
  sourceBucket: string,
  sourceKey: string,
  allowedBucket: string | undefined,
  rawPrefix: string
): boolean {
  return !!allowedBucket && sourceBucket === allowedBucket && sourceKey.startsWith(rawPrefix)
}
