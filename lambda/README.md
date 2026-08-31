# JD Dental Lab — Scan Pipeline: Lambdas + Event Wiring

End-to-end, **repeatable** setup for the scan → GLB → case pipeline. A scan lands
in S3 and fans out to two Lambdas via EventBridge:

```text
s3://<bucket>/scans/raw/…  --ObjectCreated-->  EventBridge (rule: jdlab-scan-fanout)
   ├─► SQS jdlab-scan-convert ─► jdlab-scan-convert (handler.mjs) ─► raw → scans/glb/ GLB preview
   │                 └─► DLQ jdlab-scan-convert-dlq  (poison / OOM scan → review + replay)
   └─► SQS jdlab-scan-ingest  ─► jdlab-scan-ingest (ingest-case.mjs) ─► POST /api/ingest/cases
                     └─► DLQ jdlab-scan-ingest-dlq   (unmapped / poison → review + replay)
```

Both branches are independent: a case is created even if GLB conversion fails.
Both sit behind their own SQS+DLQ, so a poison scan (OOM / corrupt) or transient
failure redrives then parks in a DLQ instead of vanishing. Idempotency rides
`externalId = s3:<key>:<etag>` (ingest) and deterministic GLB keys (convert), so
SQS at-least-once redelivery never double-creates or corrupts output.

## What this sets up

| Part | Resource | Purpose | Build? |
|------|----------|---------|--------|
| 1 | **`jdlab-scan-convert`** Lambda | STL/PLY/OBJ-zip → decimated Meshopt GLB | ⚠️ Linux x86_64 build (native `sharp`) |
| 2 | **`jdlab-scan-ingest`** Lambda | Creates a portal case per scan | Single JS file — no build |
| 3 | **EventBridge + 2×(SQS + DLQ) + IAM** | Trigger + fan-out wiring | CLI only |

> **Repeatable:** run Part 0, then Parts 1 → 3 in order. Re-running is safe — the
> `create-*` commands fail if a resource already exists, so for a **clean
> reinstall** run **Part 6 (teardown)** first, or use the `update-*` commands
> noted in each part. All JSON is inlined (heredocs), so the only files you
> upload to CloudShell are the Lambda sources.

- Convert entry point: [`handler.mjs`](handler.mjs) → `handler`; conversion core
  `convert-scan.mjs` (vendored from `../scripts/convert-scan.mjs`).
- Ingest entry point: [`ingest-case.mjs`](ingest-case.mjs) → `handler`.
- The same policy JSON is mirrored in [`aws/`](aws/) for repo-based deploys.

---

## Architecture (end-to-end)

```text
  Practice / upstream uploads scan (.stl / .ply / .obj.zip)
                    │  PutObject + x-amz-meta (doctor-email, title, tooth-ref…)
                    ▼
             S3  scans/raw/
                    │  s3:ObjectCreated
                    ▼
        EventBridge rule  jdlab-scan-fanout   (prefix = scans/raw/)
            │                                        │
   target 1 │ SQS send                      target 2 │ SQS send
            ▼                                        ▼
   SQS jdlab-scan-convert ──(≥5)──▶ DLQ      SQS  jdlab-scan-ingest ──(≥5 fails)──▶ DLQ
            │             jdlab-scan-convert-dlq     │                    jdlab-scan-ingest-dlq
            │ batch=1 (ReportBatchItemFailures)      │ batch (ReportBatchItemFailures)
            ▼                                        ▼
   jdlab-scan-convert  (handler.mjs)         jdlab-scan-ingest  (ingest-case.mjs)
   raw → GLB                                      │  HEAD object → externalId = s3:<key>:<etag>
            ▼                                      │  POST /api/ingest/cases  (Bearer token)
     S3  scans/glb/                                ▼
     (decimated preview)                    Portal API  (auth · idempotency · route doctor)
            │                                 │  409 / 422 unmapped ─▶ retry → DLQ
            │                     ┌───────────┴───────────┐
            │             addCase │                       │ server-side copyFrom
            │                     ▼                       ▼
            │               Postgres                 S3  case-attachments/cases/<id>/
            │        (cases · messages · history)
            │                     │  doctor opens case
            │                     ▼
            │             GET /api/portal/cases/[id] → resolveGlbPreviews(scan_case_id)
            └─────────────────────┤  presigned GLB URL
                                  ▼
                          Browser · ScanViewer  (orbit · pin · measure)

  Admin "Delete case" ─▶ purge: DB cascade + case-attachments + scans/raw + scans/glb
                                (no storage left anywhere in AWS)
```

- The two EventBridge targets are **independent** — a case is created even if GLB
  conversion fails; the 3D preview appears once `scans/glb/` is ready.
- **Idempotency:** `externalId = s3:<key>:<etag>` (stored as `scan_case_id`) makes
  SQS at-least-once redelivery safe.
- **Claim-check:** scan bytes never ride the queue or the HTTP body — the portal
  copies the object server-side into `case-attachments/`.
- **DLQ:** unmapped-practice (`409`/`422`) and poison messages are parked for
  human review + replay, never silently dropped.

---

## Part 0 — Prerequisites

Open **AWS CloudShell** in **us-east-1** (Linux x86_64, pre-authenticated). Set:

```bash
export AWS_PAGER=""                       # stop the pager swallowing output
SCAN_BUCKET=jdlab-scans-prod-use1
REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
PORTAL_BASE_URL=https://jdlab.us
INGEST_API_TOKEN=$(aws ssm get-parameter --name /jdlab/INGEST_API_TOKEN \
  --with-decryption --query Parameter.Value --output text --region $REGION)
```

**Upload the Lambda sources** (Actions ▸ Upload file) into `~`:

- `handler.mjs`, `package.json`, `convert-scan.mjs`  — Part 1 (`convert-scan.mjs`
  is the app's `scripts/convert-scan.mjs`)
- `ingest-case.mjs`  — Part 2

> ⚠️ Upload **this `lambda/package.json`** (6 deps), NOT the app-root one
> (~600 MB → blows the 250 MB Lambda limit).

---

## Part 1 — Convert Lambda (`jdlab-scan-convert`)

Converts raw scans to GLBs under `scans/glb/`. Bundles a native `sharp`/libvips
binary, so it **must be built on Linux x86_64** (CloudShell) and deployed as
**x86_64** — a Windows/macOS build crashes at load. Runtime: Node 22, 4096 MB,
300 s.

### 1.1 Build the bundle (in /tmp — HOME is only 1 GB)

```bash
rm -rf /tmp/lb && mkdir -p /tmp/lb
cp ~/handler.mjs ~/package.json ~/convert-scan.mjs /tmp/lb/
cd /tmp/lb
npm install --omit=dev --cache /tmp/.npmcache --no-audit --no-fund
ls node_modules/three/examples/jsm/loaders/STLLoader.js   # gate: loader present
# trim sharp to linux-x64 only if extra platforms appear:
cd node_modules/@img 2>/dev/null && for d in */; do
  case "$d" in sharp-linux-x64/|sharp-libvips-linux-x64/) ;; *) rm -rf "$d";; esac
done; cd /tmp/lb
rm -f /tmp/lambda.zip
zip -r /tmp/lambda.zip handler.mjs convert-scan.mjs package.json node_modules >/dev/null
unzip -l /tmp/lambda.zip | grep -c -i STLLoader          # must be > 0
aws s3 cp /tmp/lambda.zip s3://$SCAN_BUCKET/deploy/lambda.zip
```

`@aws-sdk/client-s3` is provided by the runtime — intentionally not a dep.

### 1.2 IAM role

```bash
cat > /tmp/trust.json <<'JSON'
{ "Version":"2012-10-17","Statement":[{
  "Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
cat > /tmp/convert-s3.json <<JSON
{ "Version":"2012-10-17","Statement":[
  {"Sid":"ReadRawScans","Effect":"Allow","Action":["s3:GetObject"],
   "Resource":"arn:aws:s3:::$SCAN_BUCKET/scans/raw/*"},
  {"Sid":"WriteConvertedGlb","Effect":"Allow","Action":["s3:PutObject"],
   "Resource":"arn:aws:s3:::$SCAN_BUCKET/scans/glb/*"},
  {"Sid":"ListRawScans","Effect":"Allow","Action":["s3:ListBucket"],
   "Resource":"arn:aws:s3:::$SCAN_BUCKET","Condition":{"StringLike":{"s3:prefix":"scans/raw/*"}}},
  {"Sid":"ConsumeConvertQueue","Effect":"Allow",
   "Action":["sqs:ReceiveMessage","sqs:DeleteMessage","sqs:GetQueueAttributes"],
   "Resource":"arn:aws:sqs:$REGION:$ACCOUNT_ID:jdlab-scan-convert"}]}
JSON
aws iam create-role --role-name jdlab-scan-convert \
  --assume-role-policy-document file:///tmp/trust.json
aws iam attach-role-policy --role-name jdlab-scan-convert \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name jdlab-scan-convert \
  --policy-name scan-s3-rw --policy-document file:///tmp/convert-s3.json
```

### 1.3 Create the function (first time)

```bash
aws lambda create-function --function-name jdlab-scan-convert \
  --runtime nodejs22.x --handler handler.handler \
  --role arn:aws:iam::$ACCOUNT_ID:role/jdlab-scan-convert \
  --code S3Bucket=$SCAN_BUCKET,S3Key=deploy/lambda.zip \
  --memory-size 4096 --timeout 300 --architectures x86_64 --region $REGION
aws lambda wait function-active --function-name jdlab-scan-convert --region $REGION
```

> **Redeploy** (after a code change) — rebuild 1.1, then:
> ```bash
> aws lambda update-function-code --function-name jdlab-scan-convert \
>   --s3-bucket $SCAN_BUCKET --s3-key deploy/lambda.zip \
>   --architectures x86_64 --region $REGION
> ```

⚠️ **Event-shape:** the trigger is SQS (Part 3), whose records wrap the
EventBridge "Object Created" event as a JSON string in `Records[].body`.
`handler.mjs` peels the SQS envelope, then normalizes the inner `detail.object.key`
(EventBridge) **and** the classic `Records[].s3` shape — so manual invokes with a
bare EventBridge/S3 payload still work. It returns `{batchItemFailures}` so a
failed scan redrives to the DLQ instead of failing the whole batch. Symptom of a
stale build: real uploads log `converted:0` (no GLB) while a manual EventBridge
invoke works → redeploy a handler that includes the SQS-envelope parsing.

### 1.4 Manual test (no trigger; needs `scans/raw/test.stl` to exist)

```bash
cat > /tmp/ev-convert.json <<JSON
{ "detail-type":"Object Created","source":"aws.s3",
  "detail":{"bucket":{"name":"$SCAN_BUCKET"},"object":{"key":"scans/raw/test.stl"}}}
JSON
aws lambda invoke --function-name jdlab-scan-convert \
  --payload file:///tmp/ev-convert.json --cli-binary-format raw-in-base64-out \
  --region $REGION /tmp/out.json
cat /tmp/out.json                         # expect {"ok":true,"converted":1}
aws s3 ls s3://$SCAN_BUCKET/scans/glb/     # expect test.glb
```

---

## Part 2 — Ingest Lambda (`jdlab-scan-ingest`)

Creates a portal case per scan. **No dependencies** (`@aws-sdk/client-s3` +
`fetch` are in the Node 22 runtime) → deploys as the single `ingest-case.mjs`
file, no build.

### 2.1 IAM role

```bash
# (create /tmp/trust.json from Part 1.2 first if you skipped Part 1)
cat > /tmp/ingest-perms.json <<JSON
{ "Version":"2012-10-17","Statement":[
  {"Sid":"HeadRawScans","Effect":"Allow","Action":["s3:GetObject"],
   "Resource":"arn:aws:s3:::$SCAN_BUCKET/scans/raw/*"},
  {"Sid":"ConsumeIngestQueue","Effect":"Allow",
   "Action":["sqs:ReceiveMessage","sqs:DeleteMessage","sqs:GetQueueAttributes"],
   "Resource":"arn:aws:sqs:$REGION:$ACCOUNT_ID:jdlab-scan-ingest"}]}
JSON
aws iam create-role --role-name jdlab-scan-ingest \
  --assume-role-policy-document file:///tmp/trust.json
aws iam attach-role-policy --role-name jdlab-scan-ingest \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name jdlab-scan-ingest \
  --policy-name ingest-perms --policy-document file:///tmp/ingest-perms.json
```

### 2.2 Deploy the function

```bash
zip -j /tmp/ingest.zip ~/ingest-case.mjs
sleep 10   # let the fresh IAM role propagate
aws lambda create-function --function-name jdlab-scan-ingest \
  --runtime nodejs22.x --handler ingest-case.handler \
  --role arn:aws:iam::$ACCOUNT_ID:role/jdlab-scan-ingest \
  --zip-file fileb:///tmp/ingest.zip \
  --memory-size 256 --timeout 300 --architectures arm64 --region $REGION \
  --environment "Variables={PORTAL_BASE_URL=$PORTAL_BASE_URL,INGEST_API_TOKEN=$INGEST_API_TOKEN}"
aws lambda wait function-active --function-name jdlab-scan-ingest --region $REGION
```

> **Redeploy:**
> ```bash
> zip -j /tmp/ingest.zip ~/ingest-case.mjs
> aws lambda update-function-code --function-name jdlab-scan-ingest \
>   --zip-file fileb:///tmp/ingest.zip --region $REGION
> ```

---

## Part 3 — Event wiring (connect the two)

### 3.1 Turn on EventBridge notifications for the bucket

```bash
aws s3api put-bucket-notification-configuration --bucket $SCAN_BUCKET \
  --notification-configuration '{"EventBridgeConfiguration":{}}'
```

> This replaces the whole notification config with EventBridge-only, removing any
> legacy direct S3→Lambda trigger (which would otherwise double-invoke convert).

### 3.2 DLQs + queues (both branches; redrive after 5 receives)

Each branch gets its own SQS queue + DLQ. Convert sits behind SQS too (not a
direct Lambda target), so a poison/OOM scan redrives then parks in a DLQ instead
of being dropped by async-invoke retry.

```bash
# --- Ingest queue + DLQ ---
DLQ_URL=$(aws sqs create-queue --queue-name jdlab-scan-ingest-dlq \
  --attributes MessageRetentionPeriod=1209600 \
  --query QueueUrl --output text --region $REGION)
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "$DLQ_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text --region $REGION)

QUEUE_URL=$(aws sqs create-queue --queue-name jdlab-scan-ingest --attributes "$(cat <<JSON
{ "VisibilityTimeout":"330","MessageRetentionPeriod":"345600",
  "RedrivePolicy":"{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"5\"}" }
JSON
)" --query QueueUrl --output text --region $REGION)
QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url "$QUEUE_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text --region $REGION)

# --- Convert queue + DLQ ---
CONV_DLQ_URL=$(aws sqs create-queue --queue-name jdlab-scan-convert-dlq \
  --attributes MessageRetentionPeriod=1209600 \
  --query QueueUrl --output text --region $REGION)
CONV_DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "$CONV_DLQ_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text --region $REGION)

CONV_QUEUE_URL=$(aws sqs create-queue --queue-name jdlab-scan-convert --attributes "$(cat <<JSON
{ "VisibilityTimeout":"360","MessageRetentionPeriod":"345600",
  "RedrivePolicy":"{\"deadLetterTargetArn\":\"$CONV_DLQ_ARN\",\"maxReceiveCount\":\"5\"}" }
JSON
)" --query QueueUrl --output text --region $REGION)
CONV_QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url "$CONV_QUEUE_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text --region $REGION)
```

> VisibilityTimeout must be ≥ the Lambda timeout: ingest 330 s ≥ 300 s; convert
> 360 s ≥ 300 s. Bump the convert queue's VisibilityTimeout if you raise the
> convert Lambda's timeout (heavy meshes) — a too-short visibility re-delivers a
> still-running message and double-converts.

### 3.3 Let EventBridge send to both queues (queue policies)

```bash
for pair in "$QUEUE_URL|$QUEUE_ARN" "$CONV_QUEUE_URL|$CONV_QUEUE_ARN"; do
  url=${pair%|*}; arn=${pair#*|}
  cat > /tmp/queue-policy.json <<JSON
{ "Version":"2012-10-17","Statement":[{
  "Sid":"AllowEventBridgeSend","Effect":"Allow",
  "Principal":{"Service":"events.amazonaws.com"},
  "Action":"sqs:SendMessage","Resource":"$arn",
  "Condition":{"ArnEquals":{"aws:SourceArn":"arn:aws:events:$REGION:$ACCOUNT_ID:rule/jdlab-scan-fanout"}}}]}
JSON
  # Pass as a JSON attribute map (stringified) via jq — the Key=Value shorthand
  # breaks on the policy JSON's commas.
  aws sqs set-queue-attributes --queue-url "$url" --region $REGION \
    --attributes "$(jq -n --arg p "$(cat /tmp/queue-policy.json)" '{Policy:$p}')"
done
```

### 3.4 EventBridge rule + both targets (both are queues now)

```bash
cat > /tmp/pattern.json <<JSON
{ "source":["aws.s3"],"detail-type":["Object Created"],
  "detail":{"bucket":{"name":["$SCAN_BUCKET"]},"object":{"key":[{"prefix":"scans/raw/"}]}}}
JSON
aws events put-rule --name jdlab-scan-fanout --region $REGION \
  --event-pattern file:///tmp/pattern.json

# Both targets are SQS queues now (convert is no longer a direct Lambda target).
aws events put-targets --rule jdlab-scan-fanout --region $REGION --targets \
  "Id=convert,Arn=$CONV_QUEUE_ARN" \
  "Id=ingest,Arn=$QUEUE_ARN"
```

> **Migrating an existing install:** the old rule had a direct-Lambda `convert`
> target and a `lambda add-permission` (`--statement-id eb-fanout`). `put-targets`
> above overwrites the target in place; optionally drop the now-unused permission:
> `aws lambda remove-permission --function-name jdlab-scan-convert --statement-id eb-fanout --region $REGION`.

### 3.5 Wire both queues → their Lambdas (partial-batch failures)

```bash
# Ingest: small batches are fine (cheap POST per message).
aws lambda create-event-source-mapping --function-name jdlab-scan-ingest \
  --event-source-arn "$QUEUE_ARN" --batch-size 10 \
  --function-response-types ReportBatchItemFailures --region $REGION

# Convert: batch-size 1 (one heavy mesh job per invocation) + a concurrency cap
# so a burst of uploads can't spawn N memory-heavy converts at once.
aws lambda create-event-source-mapping --function-name jdlab-scan-convert \
  --event-source-arn "$CONV_QUEUE_ARN" --batch-size 1 \
  --scaling-config MaximumConcurrency=5 \
  --function-response-types ReportBatchItemFailures --region $REGION
```

`ReportBatchItemFailures` lets one bad message retry without re-running the whole
batch; after `maxReceiveCount` (5) it lands in the matching `…-dlq`. The convert
mapping uses `batch-size 1` (one scan per invocation — a failure only redrives
that scan) and `MaximumConcurrency=5` to bound peak memory/cost under a burst.

---

## Part 4 — Verify end-to-end

```bash
# tail both Lambdas (separate shells)
aws logs tail /aws/lambda/jdlab-scan-convert --follow --format short --region $REGION
aws logs tail /aws/lambda/jdlab-scan-ingest  --follow --format short --region $REGION

# drop a real scan (metadata routes it to a mapped doctor / practice)
aws s3 cp yourscan.stl s3://$SCAN_BUCKET/scans/raw/lindqvist/yourscan.stl \
  --metadata doctor-email=REAL_DOCTOR@EXAMPLE.COM,title="Test",case-type=crown
```

Expect: convert logs `converted … → scans/glb/…`; ingest logs `case created: …`;
the case appears in the portal with a 3D preview. A `409`/`422` means the
practice/doctor isn't mapped — fix it in the portal, then replay the DLQ.

Confirm the live trigger matches the repo config:

```bash
aws events describe-rule --name jdlab-scan-fanout --region $REGION --query EventPattern
aws events list-targets-by-rule --rule jdlab-scan-fanout --region $REGION --query 'Targets[].Arn'
```

---

## Part 5 — Reinstall / redeploy quick reference

| Change | Command |
|--------|---------|
| Convert code | rebuild Part 1.1 → `update-function-code … jdlab-scan-convert` |
| Ingest code | `zip -j /tmp/ingest.zip ~/ingest-case.mjs` → `update-function-code … jdlab-scan-ingest` |
| Ingest env var | `aws lambda update-function-configuration --function-name jdlab-scan-ingest --environment …` |
| Rule pattern | re-run Part 3.4 `put-rule` (idempotent) |
| Repoint convert to SQS (migration) | re-run Part 3.2–3.5 convert lines |
| Full clean reinstall | Part 6 teardown → Parts 1–3 |

---

## Part 6 — Teardown

```bash
for fn in jdlab-scan-ingest jdlab-scan-convert; do
  uuid=$(aws lambda list-event-source-mappings --function-name $fn \
    --query 'EventSourceMappings[0].UUID' --output text --region $REGION)
  [ "$uuid" != "None" ] && aws lambda delete-event-source-mapping --uuid "$uuid" --region $REGION
done
aws events remove-targets --rule jdlab-scan-fanout --ids convert ingest --region $REGION
aws events delete-rule --name jdlab-scan-fanout --region $REGION
aws lambda delete-function --function-name jdlab-scan-ingest --region $REGION
aws lambda delete-function --function-name jdlab-scan-convert --region $REGION
aws sqs delete-queue --queue-url "$QUEUE_URL" --region $REGION
aws sqs delete-queue --queue-url "$DLQ_URL" --region $REGION
aws sqs delete-queue --queue-url "$CONV_QUEUE_URL" --region $REGION
aws sqs delete-queue --queue-url "$CONV_DLQ_URL" --region $REGION
aws iam delete-role-policy --role-name jdlab-scan-ingest  --policy-name ingest-perms 2>/dev/null
aws iam delete-role-policy --role-name jdlab-scan-convert --policy-name scan-s3-rw   2>/dev/null
for r in jdlab-scan-ingest jdlab-scan-convert; do
  aws iam detach-role-policy --role-name $r \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null
  aws iam delete-role --role-name $r 2>/dev/null
done
# leaves the bucket on EventBridge notifications; disable with an empty config if desired.
```

---

## Environment (Lambda defaults — override only if needed)

**Convert (`jdlab-scan-convert`)**

| Var | Default | Meaning |
|-----|---------|---------|
| `RAW_PREFIX` | `scans/raw/` | input prefix |
| `GLB_PREFIX` | `scans/glb/` | output prefix |
| `GLB_BUCKET` | source bucket | destination bucket |
| `TARGET_TRIS` | 350k | triangle budget |

**Ingest (`jdlab-scan-ingest`)**

| Var | Default | Meaning |
|-----|---------|---------|
| `PORTAL_BASE_URL` | — (required) | portal base URL |
| `INGEST_API_TOKEN` | — (required) | matches the portal token |
| `RAW_PREFIX` / `PROCESSED_PREFIX` / `UNMAPPED_PREFIX` | `scans/raw/` / `processed/` / `unmapped/` | skip / route prefixes |

---

## Gotchas (learned the hard way)

- **CloudShell is per-region.** Run the whole runbook in **us-east-1** — the
  home dir (your uploads) and every resource you create live only in that
  region. Opening CloudShell in another region shows a *fresh empty home* and an
  *empty default event bus*, which looks like nothing was set up.
- **Convert must build on Linux x86_64.** Native `sharp`/libvips is OS/CPU
  specific; a Windows/macOS build → `Cannot find module '…sharp-linux-x64…'`.
  Deploy x86_64 to match CloudShell.
- **Event-shape:** ingest parses the SQS envelope then EventBridge `detail.*` /
  classic `Records[].s3`; convert now does the same (SQS `Records[].body` →
  EventBridge `detail.*`). A convert build that only reads a bare EventBridge
  event no-ops on the SQS path (`batchItemFailures` empty, no GLB) but "works" on
  a manual `{detail:{…}}` invoke — redeploy the SQS-aware handler.
- **SQS policy** must be a stringified JSON attribute map via `jq` — the
  `Key=Value` shorthand breaks on the policy's commas.
- **CloudShell HOME is 1 GB** → build in `/tmp` (`--cache /tmp/.npmcache`).
- **Convert deploy via S3** (`--s3-bucket/--s3-key`); `--zip-file` inline caps at
  50 MB. Ingest is tiny → inline `--zip-file` is fine.
- **VisibilityTimeout ≥ Lambda timeout** (ingest 330 ≥ 300; convert 360 ≥ 300).
- **Phantom `s3:ListBucket` AccessDenied** on convert = the object doesn't exist.
  Without `ListBucket`, S3 masks 404 as `403 AccessDenied` naming `s3:ListBucket`.
  The role grants a `scans/raw/*`-scoped `ListBucket` so a real miss logs a clean
  `NoSuchKey` — GetObject of an existing object never needed it.
- **IAM propagation:** `sleep 10` before `create-function` after making a role.
- **`create-*` fails if the resource exists** — use `update-*` or teardown first.
- `export AWS_PAGER=""` so the CLI pager doesn't hijack output.
- Store `INGEST_API_TOKEN` in SSM/Secrets Manager (Part 0), not inline.

---

## Notes

- **No file relocation:** the pipeline never moves raw scans out of `scans/raw/`
  (no LIST to keep cheap). Add an S3 lifecycle rule to expire/archive
  `scans/raw/` if storage grows — but note dental scans often carry a 7–10 yr
  retention obligation (archive, don't delete).
- **Alarms:** watch DLQ `ApproximateNumberOfMessagesVisible` and both Lambdas'
  `Errors`.
- The former Python `ingestion/` poller was removed — ingestion is entirely the
  ingest Lambda now (no always-on container).
- **CBCT-sized files:** revisit the 4 GB / 300 s convert sizing + S3 multipart if
  large CBCT/DICOM inputs are added.
