# Telemetry pipeline — Firehose → S3 (Parquet) → Athena

Minimal architecture. **No extra moving parts:**

```
app (EC2)  --PutRecordBatch (NDJSON)-->  Kinesis Firehose  --converts JSON→Parquet-->  S3 (Parquet)
                                                                                          ^
                                              Glue Data Catalog table (schema only) ------+
                                                                                          |
Athena  --SELECT ... (partition projection on dt)----------------------------------------+
```

- **Firehose** buffers records and flushes **Parquet** files straight to S3 (record-format conversion is built in — no Lambda/ETL).
- **Glue table** = metadata only (columns + Parquet SerDe). Firehose reads it to convert; Athena reads it to query. Same table, one schema.
- **Athena** queries the Parquet in place. **Partition projection** on a `dt` date means no crawler and no `ADD PARTITION` — nothing to maintain.

Run everything below in **AWS CloudShell** (bash) in the account/region that hosts the app.

---

## 0. Variables

```bash
export AWS_REGION=us-east-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

export DATA_BUCKET=jdlab-docs-bucket-hpncyz    # existing app docs bucket (not created here)
export DATA_PREFIX=telemetry                    # logical "data bucket": s3://$DATA_BUCKET/$DATA_PREFIX/
export RESULTS_BUCKET=jdlab-docs-bucket-hpncyz # same bucket for Athena query output
export ATHENA_PREFIX=athena                     # Athena results: s3://$RESULTS_BUCKET/$ATHENA_PREFIX/
export GLUE_DB=jdlab
export GLUE_TABLE=telemetry
export STREAM=jdlab-telemetry                 # Firehose delivery stream name
export WORKGROUP=jdlab
export FH_ROLE=jdlab-firehose-telemetry       # IAM role Firehose assumes
```

---

## 1. S3 bucket (reusing your existing app docs bucket)

`jdlab-docs-bucket-hpncyz` already exists — it's your app's attachment/docs bucket, already
encrypted (SSE-S3) with public access blocked from when it was provisioned. Telemetry is a
self-contained namespace **inside** that bucket at the `$DATA_PREFIX/` (default `telemetry/`)
prefix, with Athena output under `$ATHENA_PREFIX/` (default `athena/`) — isolated from your
existing objects, so **there is nothing to create here — skip to §2.**

> Prefer a dedicated telemetry bucket instead? Point `DATA_BUCKET`/`RESULTS_BUCKET` at a new
> name in §0 and create it:
>
> ```bash
> aws s3api create-bucket --bucket "$DATA_BUCKET" --region "$AWS_REGION" \
>   $( [ "$AWS_REGION" = us-east-1 ] || echo --create-bucket-configuration LocationConstraint=$AWS_REGION )
> aws s3api put-bucket-encryption --bucket "$DATA_BUCKET" --server-side-encryption-configuration \
>   '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
> aws s3api put-public-access-block --bucket "$DATA_BUCKET" --public-access-block-configuration \
>   BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
> ```

---

## 2. Glue database + table (the shared schema)

Create the DB, then the table via Athena DDL (registers in the Glue Data Catalog).

```bash
aws glue create-database --database-input "{\"Name\":\"$GLUE_DB\"}" --region "$AWS_REGION"
```

The table. Columns match the enriched telemetry record; `props` is stored as a **JSON string**
(see the one code change in §7). Partitioned by `dt` (date) via **partition projection** so no
partitions ever need registering.

```sql
CREATE EXTERNAL TABLE IF NOT EXISTS jdlab.telemetry (
  sid        string,
  ev         string,
  kind       string,     -- 'error' for app/client errors (else null)
  level      string,     -- 'error' (else null)
  client_t   bigint,
  url        string,
  props      string,      -- JSON string; use json_extract() in queries
  uid        string,
  role       string,
  ingest_t   bigint,
  ip         string,
  ua         string,
  -- application error fields (lib/error-log.ts + instrumentation.ts onRequestError).
  -- The table schema is the UNION of interaction + error records; a row simply
  -- leaves the columns it doesn't use as NULL. New columns are appended LAST so
  -- Parquet ordinal mapping of older files stays valid.
  message    string,
  name       string,
  stack      string,
  route      string,
  method     string,
  route_type string,
  status     int,
  case_token string,
  detail     string,
  env        string,
  -- correlation: req_id groups one request / ingest-batch; sid (first column) ties
  -- a server error into the client's interaction-event timeline for that session.
  req_id     string
)
PARTITIONED BY (dt string)
STORED AS PARQUET
LOCATION 's3://jdlab-docs-bucket-hpncyz/telemetry/'   -- = s3://$DATA_BUCKET/$DATA_PREFIX/
TBLPROPERTIES (
  'parquet.compression'='SNAPPY',
  'projection.enabled'='true',
  'projection.dt.type'='date',
  'projection.dt.range'='2026-01-01,NOW',
  'projection.dt.format'='yyyy-MM-dd',
  'projection.dt.interval'='1',
  'projection.dt.interval.unit'='DAYS',
  'storage.location.template'='s3://jdlab-docs-bucket-hpncyz/telemetry/dt=${dt}/'  -- s3://$DATA_BUCKET/$DATA_PREFIX/dt=${dt}/
);
```

> **Application errors flow through this same table.** `lib/error-log.ts` (+ the
> `instrumentation.ts` `onRequestError` hook and `client_error` events) ship records
> flagged `kind='error'`. Those carry the `message/name/stack/route/method/route_type/
> status/case_token/detail/env` columns above, plus **`req_id`** (a per-request
> correlation id) and **`sid`** (the client session id, mirrored into the `jdlab_sid`
> cookie by the telemetry client) so a server error ties into that session's
> interaction-event timeline. **Firehose drops any field not in the Glue table**, so
> if you add more record fields later, add matching columns here too.
>
> **If the table already exists**, don't recreate — append the new columns (safe, they
> map to NULL for old files):
> ```sql
> ALTER TABLE jdlab.telemetry ADD COLUMNS (
>   kind string, level string, message string, name string, stack string,
>   route string, method string, route_type string, status int,
>   case_token string, detail string, env string, req_id string
> );
> ```
> Firehose uses `SchemaConfiguration.VersionId=LATEST`, so it picks up the new
> columns automatically on the next flush — no stream change needed.

Run that DDL from CloudShell (replace bucket names if you changed the vars):

```bash
# Create the Athena workgroup first (used to run the DDL and all queries)
aws athena create-work-group --name "$WORKGROUP" --region "$AWS_REGION" \
  --configuration "ResultConfiguration={OutputLocation=s3://$RESULTS_BUCKET/$ATHENA_PREFIX/}"

DDL="CREATE EXTERNAL TABLE IF NOT EXISTS $GLUE_DB.$GLUE_TABLE (sid string, ev string, kind string, level string, client_t bigint, url string, props string, uid string, role string, ingest_t bigint, ip string, ua string, message string, name string, stack string, route string, method string, route_type string, status int, case_token string, detail string, env string, req_id string) PARTITIONED BY (dt string) STORED AS PARQUET LOCATION 's3://$DATA_BUCKET/$DATA_PREFIX/' TBLPROPERTIES ('parquet.compression'='SNAPPY','projection.enabled'='true','projection.dt.type'='date','projection.dt.range'='2026-01-01,NOW','projection.dt.format'='yyyy-MM-dd','projection.dt.interval'='1','projection.dt.interval.unit'='DAYS','storage.location.template'='s3://$DATA_BUCKET/$DATA_PREFIX/dt=\${dt}/');"

aws athena start-query-execution --region "$AWS_REGION" \
  --work-group "$WORKGROUP" \
  --query-string "$DDL"
```

---

## 3. IAM role for Firehose

Trust policy + permissions (write S3, read the Glue schema for conversion).

```bash
aws iam create-role --role-name "$FH_ROLE" --assume-role-policy-document '{
  "Version":"2012-10-17",
  "Statement":[{"Effect":"Allow","Principal":{"Service":"firehose.amazonaws.com"},"Action":"sts:AssumeRole"}]
}'

cat > /tmp/fh-policy.json <<EOF
{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Effect":"Allow",
      "Action":["s3:AbortMultipartUpload","s3:GetBucketLocation","s3:GetObject","s3:ListBucket","s3:ListBucketMultipartUploads","s3:PutObject"],
      "Resource":["arn:aws:s3:::$DATA_BUCKET","arn:aws:s3:::$DATA_BUCKET/$DATA_PREFIX/*"]
    },
    {
      "Effect":"Allow",
      "Action":["glue:GetTable","glue:GetTableVersion","glue:GetTableVersions","glue:GetDatabase"],
      "Resource":[
        "arn:aws:glue:$AWS_REGION:$ACCOUNT_ID:catalog",
        "arn:aws:glue:$AWS_REGION:$ACCOUNT_ID:database/$GLUE_DB",
        "arn:aws:glue:$AWS_REGION:$ACCOUNT_ID:table/$GLUE_DB/$GLUE_TABLE"
      ]
    },
    {
      "Effect":"Allow",
      "Action":["logs:PutLogEvents","logs:CreateLogStream","logs:CreateLogGroup"],
      "Resource":"arn:aws:logs:$AWS_REGION:$ACCOUNT_ID:log-group:/aws/kinesisfirehose/$STREAM:*"
    }
  ]
}
EOF

aws iam put-role-policy --role-name "$FH_ROLE" --policy-name firehose-telemetry --policy-document file:///tmp/fh-policy.json
export FH_ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$FH_ROLE"
```

---

## 4. Firehose delivery stream (JSON → Parquet)

Key points: `CompressionFormat` **must be UNCOMPRESSED** when format conversion is on
(Parquet compresses itself via SNAPPY); the `Prefix` uses Firehose's timestamp namespace so
files land under Hive-style `dt=YYYY-MM-DD/` partitions.

```bash
cat > /tmp/fh.json <<EOF
{
  "RoleARN": "$FH_ROLE_ARN",
  "BucketARN": "arn:aws:s3:::$DATA_BUCKET",
  "Prefix": "$DATA_PREFIX/dt=!{timestamp:yyyy-MM-dd}/",
  "ErrorOutputPrefix": "$DATA_PREFIX/_errors/!{firehose:error-output-type}/dt=!{timestamp:yyyy-MM-dd}/",
  "BufferingHints": { "SizeInMBs": 128, "IntervalInSeconds": 300 },
  "CompressionFormat": "UNCOMPRESSED",
  "DataFormatConversionConfiguration": {
    "Enabled": true,
    "InputFormatConfiguration": { "Deserializer": { "OpenXJsonSerDe": {} } },
    "OutputFormatConfiguration": { "Serializer": { "ParquetSerDe": { "Compression": "SNAPPY" } } },
    "SchemaConfiguration": {
      "RoleARN": "$FH_ROLE_ARN",
      "DatabaseName": "$GLUE_DB",
      "TableName": "$GLUE_TABLE",
      "Region": "$AWS_REGION",
      "VersionId": "LATEST"
    }
  },
  "CloudWatchLoggingOptions": { "Enabled": true, "LogGroupName": "/aws/kinesisfirehose/$STREAM", "LogStreamName": "S3Delivery" }
}
EOF

aws firehose create-delivery-stream --region "$AWS_REGION" \
  --delivery-stream-name "$STREAM" \
  --delivery-stream-type DirectPut \
  --extended-s3-destination-configuration file:///tmp/fh.json
```

> Buffering = 128 MB / 300s. Telemetry is low-volume, so most flushes will hit the **5-minute**
> timer, giving one Parquet file every ~5 min. Raise the interval (max 900s) to get fewer, larger
> files if you prefer.
>
> Delivery-**failure** records land under `$DATA_PREFIX/_errors/` (same namespace, one IAM grant).
> They're invisible to Athena: partition projection only reads `…/$DATA_PREFIX/dt=<date>/` paths,
> so the `_errors/` subfolder is never scanned.

---

## 5. Grant the app (EC2 instance role) access

Replace `APP_INSTANCE_ROLE` with the role your EC2/app already uses (same one that reads S3 today).

```bash
export APP_ROLE=APP_INSTANCE_ROLE

cat > /tmp/app-telemetry.json <<EOF
{
  "Version":"2012-10-17",
  "Statement":[
    { "Sid":"FirehoseWrite","Effect":"Allow",
      "Action":["firehose:PutRecord","firehose:PutRecordBatch"],
      "Resource":"arn:aws:firehose:$AWS_REGION:$ACCOUNT_ID:deliverystream/$STREAM" },

    { "Sid":"AthenaQuery","Effect":"Allow",
      "Action":["athena:StartQueryExecution","athena:GetQueryExecution","athena:GetQueryResults","athena:StopQueryExecution","athena:GetWorkGroup"],
      "Resource":"arn:aws:athena:$AWS_REGION:$ACCOUNT_ID:workgroup/$WORKGROUP" },

    { "Sid":"GlueRead","Effect":"Allow",
      "Action":["glue:GetTable","glue:GetDatabase","glue:GetPartitions"],
      "Resource":[
        "arn:aws:glue:$AWS_REGION:$ACCOUNT_ID:catalog",
        "arn:aws:glue:$AWS_REGION:$ACCOUNT_ID:database/$GLUE_DB",
        "arn:aws:glue:$AWS_REGION:$ACCOUNT_ID:table/$GLUE_DB/$GLUE_TABLE"
      ] },

    { "Sid":"ReadData","Effect":"Allow",
      "Action":["s3:GetObject","s3:ListBucket","s3:GetBucketLocation"],
      "Resource":["arn:aws:s3:::$DATA_BUCKET","arn:aws:s3:::$DATA_BUCKET/$DATA_PREFIX/*"] },

    { "Sid":"AthenaResults","Effect":"Allow",
      "Action":["s3:GetObject","s3:PutObject","s3:ListBucket","s3:GetBucketLocation"],
      "Resource":["arn:aws:s3:::$RESULTS_BUCKET","arn:aws:s3:::$RESULTS_BUCKET/$ATHENA_PREFIX/*"] }
  ]
}
EOF

aws iam put-role-policy --role-name "$APP_ROLE" --policy-name telemetry-firehose-athena --policy-document file:///tmp/app-telemetry.json
```

---

## 6. App environment variables

Set these on the app (the write path already exists in `lib/telemetry-sink.ts`):

```bash
TELEMETRY_FIREHOSE_STREAM=jdlab-telemetry
AWS_REGION=us-east-1
# read side (Athena) — used by the getLastViewed/telemetry-query Athena impl:
ATHENA_DATABASE=jdlab
ATHENA_TABLE=telemetry
ATHENA_WORKGROUP=jdlab
ATHENA_OUTPUT=s3://jdlab-docs-bucket-hpncyz/athena/
```

With `TELEMETRY_FIREHOSE_STREAM` set, `lib/telemetry-sink.ts` ships to Firehose instead of the
local NDJSON dev file — no code change needed on the write path.

---

## 7. `props` as a JSON string — already handled at the delivery boundary

Firehose Parquet conversion needs each field to match the Glue schema. `props` is a nested,
variable object, so it's declared as a single **`props string`** column (see §2) and must be
shipped as a JSON string. This is done at the **delivery boundary**, not in the ingest route, so
that `npm run dev` and production share one codebase:

- **Dev** (`TELEMETRY_FIREHOSE_STREAM` unset) — `lib/telemetry-sink.ts` writes the local NDJSON
  with `props` as an **object**, and the read side reads it back as an object. Nothing changes.
- **Prod** (`TELEMETRY_FIREHOSE_STREAM` set) — `lib/telemetry-sink.ts` runs each record through
  `serializeForDelivery()`, which `JSON.stringify`s `props` (and maps an absent `props` to
  explicit `null`) *only* on the Firehose path → clean `props string` Parquet column.

```ts
// lib/telemetry-sink.ts — applied only on the Firehose PutRecordBatch path:
Records: chunk.map(r => ({ Data: Buffer.from(JSON.stringify(serializeForDelivery(r)) + '\n') })),
```

The read side (`lib/telemetry-query.ts`) is source-agnostic: `normalizeRecord()` parses a string
`props` back to an object, so records round-trip identically whether they came from dev NDJSON or
Athena/Parquet. Query the JSON in Athena with `json_extract` / `json_extract_scalar`, e.g.
`json_extract_scalar(props, '$.caseId')`.

> **No ingest-route edit is needed** — the ingest enrichment in
> `app/api/portal/telemetry/route.ts` keeps `props` as an object. (An earlier version of this
> runbook told you to `JSON.stringify` it there; that breaks the dev admin viewer, which reads
> `props` as an object. The boundary approach above supersedes it.)

(The read side is **implemented** and gated the same way: `lib/telemetry-query.ts` reads the local
NDJSON in dev, and when `TELEMETRY_FIREHOSE_STREAM` is set it queries **Athena**
(`@aws-sdk/client-athena` StartQueryExecution → poll → GetQueryResults), bounded to the last
`TELEMETRY_LOOKBACK_DAYS` (default 7) via the `dt` partition so each scan stays in the KB–MB
range. `normalizeRecord()` parses the string `props` column back to an object, so the admin viewer
is source-agnostic. It needs the §6 `ATHENA_*` env vars and the §5 Athena/Glue/S3 IAM grants.)

---

## 8. Verify

```bash
# a) send a test record
aws firehose put-record --region "$AWS_REGION" --delivery-stream-name "$STREAM" \
  --record 'Data=eyJzaWQiOiJ0ZXN0IiwiZXYiOiJwaW5nIiwiaW5nZXN0X3QiOjE3MDAwMDAwMDAwMDB9Cg=='
#   (base64 of: {"sid":"test","ev":"ping","ingest_t":1700000000000}\n )

# b) after the buffer flushes (~5 min), Parquet appears:
aws s3 ls "s3://$DATA_BUCKET/$DATA_PREFIX/" --recursive

# c) query it
aws athena start-query-execution --region "$AWS_REGION" --work-group "$WORKGROUP" \
  --query-string "SELECT ev, count(*) FROM $GLUE_DB.$GLUE_TABLE WHERE dt >= date_format(current_date - interval '7' day, '%Y-%m-%d') GROUP BY ev;"
# then: aws athena get-query-results --query-execution-id <id-from-above>

# d) recent application errors (server + client), most recent first — diagnostic.
#    Includes stack/detail/uid/role/sid/req_id; coalesces client_error detail out
#    of the JSON `props` column (client errors arrive via the telemetry route, so
#    their message/stack live in props).
aws athena start-query-execution --region "$AWS_REGION" --work-group "$WORKGROUP" \
  --query-string "SELECT from_unixtime(ingest_t/1000) AS t, ev, req_id, sid, uid, role, coalesce(route, url) AS location, status, coalesce(name, 'ClientError') AS name, coalesce(message, json_extract_scalar(props, '\$.message')) AS message, detail, case_token, coalesce(stack, json_extract_scalar(props, '\$.stack')) AS stack FROM $GLUE_DB.$GLUE_TABLE WHERE dt >= date_format(current_date - interval '7' day, '%Y-%m-%d') AND kind = 'error' ORDER BY ingest_t DESC LIMIT 50;"

# e) session timeline — everything (errors + interactions) for one session, to see
#    what the user did right before an error. Use the sid from an error row above.
aws athena start-query-execution --region "$AWS_REGION" --work-group "$WORKGROUP" \
  --query-string "SELECT from_unixtime(ingest_t/1000) AS t, kind, ev, coalesce(route, url) AS location, coalesce(message, json_extract_scalar(props, '\$.message')) AS message FROM $GLUE_DB.$GLUE_TABLE WHERE dt >= date_format(current_date - interval '7' day, '%Y-%m-%d') AND sid = '<sid-from-an-error-row>' ORDER BY ingest_t;"
```

---

## Cost (this stays cheap)

- **Firehose:** ~$0.029/GB ingested. Telemetry is tiny → cents/month.
- **S3:** ~$0.023/GB-month; Parquet+SNAPPY keeps it small.
- **Athena:** $5/TB scanned, **10 MB min per query**. Always filter on `dt` (partition projection
  prunes to the day's file) → each query scans KB–MB → effectively free at this scale.
- **Glue Data Catalog:** free-tier territory (first 1M objects/requests).

No servers, no idle cost — pay only per record ingested and per query scanned.

## What is intentionally NOT here (kept simple)

- No Glue **crawler** (partition projection replaces it).
- No **Lambda**/ETL (Firehose converts to Parquet natively).
- No **dynamic partitioning by doctor** (adds a per-GB surcharge + a 500-partition limit); a single
  `dt` date partition is enough at this scale. Revisit only if per-doctor scans get slow.
