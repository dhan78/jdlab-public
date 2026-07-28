/**
 * Server-side telemetry sink. Ships interaction events to a Kinesis Firehose
 * delivery stream (which buffers + writes NDJSON to S3). Credentials come from
 * the EC2 instance IAM role — no static keys (same pattern as lib/storage.ts).
 *
 * Required env for delivery: TELEMETRY_FIREHOSE_STREAM, AWS_REGION.
 * When the stream is not configured (local dev), events are appended to a local
 * NDJSON file so the whole pipeline is testable without AWS.
 *
 * Writes are best-effort and never throw — telemetry must not affect the app.
 */
import { FirehoseClient, PutRecordBatchCommand } from '@aws-sdk/client-firehose'

const STREAM = process.env.TELEMETRY_FIREHOSE_STREAM
const REGION = process.env.AWS_REGION ?? 'us-east-1'
const DEV_FILE = process.env.TELEMETRY_DEV_FILE ?? 'telemetry-dev.ndjson'

// Firehose PutRecordBatch limits: 500 records / 4 MB per call, 1 MB per record.
const MAX_RECORDS_PER_CALL = 500

export function isTelemetryDeliveryEnabled(): boolean {
  return !!STREAM
}

let _client: FirehoseClient | null = null
function client(): FirehoseClient {
  if (!_client) _client = new FirehoseClient({ region: REGION })
  return _client
}

/**
 * Ship a batch of already-enriched event objects. Each record is one NDJSON
 * line so Firehose's concatenated S3 objects stay newline-delimited (Athena /
 * Glue friendly). Resolves quickly; callers should NOT block a user request on
 * it (fire-and-forget from the route handler).
 */
export async function shipTelemetry(records: unknown[]): Promise<void> {
  if (records.length === 0) return

  // Local dev fallback: no Firehose configured -> append NDJSON to a file.
  if (!STREAM) {
    try {
      const { appendFile } = await import('fs/promises')
      const line = records.map(r => JSON.stringify(r)).join('\n') + '\n'
      await appendFile(DEV_FILE, line)
    } catch {
      /* ignore dev-file errors */
    }
    return
  }

  try {
    for (let i = 0; i < records.length; i += MAX_RECORDS_PER_CALL) {
      const chunk = records.slice(i, i + MAX_RECORDS_PER_CALL)
      await client().send(
        new PutRecordBatchCommand({
          DeliveryStreamName: STREAM,
          Records: chunk.map(r => ({ Data: Buffer.from(JSON.stringify(r) + '\n') })),
        })
      )
    }
  } catch (err) {
    // Never throw — just note it server-side.
    console.error('[telemetry] firehose ship failed:', (err as Error).message)
  }
}
