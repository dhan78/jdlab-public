# JD Dental Lab — Scan Pipeline: Lambdas + Event Wiring

End-to-end, **repeatable** setup for the scan → GLB → case pipeline. A scan lands
in S3 and fans out to two Lambdas via EventBridge:

```text
s3://<bucket>/scans/raw/…  --ObjectCreated-->  EventBridge (rule: jdlab-scan-fanout)
   ├─► jdlab-scan-convert   (handler.mjs)      raw → scans/glb/ GLB preview
   └─► SQS jdlab-scan-ingest ─► jdlab-scan-ingest (ingest-case.mjs) ─► POST /api/ingest/cases
                     └─► DLQ jdlab-scan-ingest-dlq  (unmapped / poison → review + replay)
```

Both branches are independent: a case is created even if GLB conversion fails.
Idempotency rides `externalId = s3:<key>:<etag>`, so SQS at-least-once redelivery
never double-creates.

## What this sets up

| Part | Resource | Purpose | Build? |
|------|----------|---------|--------|
| 1 | **`jdlab-scan-convert`** Lambda | STL/PLY/OBJ-zip → decimated Meshopt GLB | ⚠️ Linux x86_64 build (native `sharp`) |
| 2 | **`jdlab-scan-ingest`** Lambda | Creates a portal case per scan | Single JS file — no build |
| 3 | **EventBridge + SQS + DLQ + IAM** | Trigger + fan-out wiring | CLI only |

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
   target 1 │ Lambda invoke                 target 2 │ SQS send
            ▼                                        ▼
   jdlab-scan-convert                        SQS  jdlab-scan-ingest ──(≥5 fails)──▶ DLQ
   handler.mjs:  raw → GLB                        │                    jdlab-scan-ingest-dlq
            │                                      │ batch (ReportBatchItemFailures)
            ▼                                      ▼
     S3  scans/glb/                        jdlab-scan-ingest  (ingest-case.mjs)
     (decimated preview)                          │  HEAD object → externalId = s3:<key>:<etag>
            │                                      │  POST /api/ingest/cases  (Bearer token)
            │                                      ▼
            │                               Portal API  (auth · idempotency · route doctor)
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
   "Resource":"arn:aws:s3:::$SCAN_BUCKET/scans/glb/*"}]}
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

⚠️ **Event-shape:** the trigger is EventBridge (Part 3), whose events use
`detail.object.key` — NOT the classic `Records[].s3` shape. `handler.mjs`
normalizes **both**. Symptom of a stale build: real uploads log `converted:0`
(no GLB) while a manual invoke with a `{"Records":[…]}` payload works → redeploy
a handler that includes the `detail.*` parsing.

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

### 3.2 DLQ + ingest queue (redrive after 5 receives)

```bash
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
```

> VisibilityTimeout (330 s) must be ≥ the ingest Lambda timeout (300 s).

### 3.3 Let EventBridge send to the queue (queue policy)

```bash
cat > /tmp/queue-policy.json <<JSON
{ "Version":"2012-10-17","Statement":[{
  "Sid":"AllowEventBridgeSend","Effect":"Allow",
  "Principal":{"Service":"events.amazonaws.com"},
  "Action":"sqs:SendMessage","Resource":"$QUEUE_ARN",
  "Condition":{"ArnEquals":{"aws:SourceArn":"arn:aws:events:$REGION:$ACCOUNT_ID:rule/jdlab-scan-fanout"}}}]}
JSON
# Pass as a JSON attribute map (stringified) via jq — the Key=Value shorthand
# breaks on the policy JSON's commas.
aws sqs set-queue-attributes --queue-url "$QUEUE_URL" --region $REGION \
  --attributes "$(jq -n --arg p "$(cat /tmp/queue-policy.json)" '{Policy:$p}')"
```

### 3.4 EventBridge rule + both targets

```bash
cat > /tmp/pattern.json <<JSON
{ "source":["aws.s3"],"detail-type":["Object Created"],
  "detail":{"bucket":{"name":["$SCAN_BUCKET"]},"object":{"key":[{"prefix":"scans/raw/"}]}}}
JSON
aws events put-rule --name jdlab-scan-fanout --region $REGION \
  --event-pattern file:///tmp/pattern.json

# Target 1: the conversion Lambda. Target 2: the ingest SQS queue.
aws events put-targets --rule jdlab-scan-fanout --region $REGION --targets \
  "Id=convert,Arn=arn:aws:lambda:$REGION:$ACCOUNT_ID:function:jdlab-scan-convert" \
  "Id=ingest,Arn=$QUEUE_ARN"

# Allow the rule to invoke the conversion Lambda (queue perm was 3.3).
aws lambda add-permission --function-name jdlab-scan-convert \
  --statement-id eb-fanout --action lambda:InvokeFunction \
  --principal events.amazonaws.com --region $REGION \
  --source-arn arn:aws:events:$REGION:$ACCOUNT_ID:rule/jdlab-scan-fanout
```

### 3.5 Wire SQS → ingest Lambda (partial-batch failures)

```bash
aws lambda create-event-source-mapping --function-name jdlab-scan-ingest \
  --event-source-arn "$QUEUE_ARN" --batch-size 10 \
  --function-response-types ReportBatchItemFailures --region $REGION
```

`ReportBatchItemFailures` lets one bad message retry without re-running the whole
batch; after `maxReceiveCount` (5) it lands in `jdlab-scan-ingest-dlq`.

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
| Full clean reinstall | Part 6 teardown → Parts 1–3 |

---

## Part 6 — Teardown

```bash
aws lambda delete-event-source-mapping --uuid "$(aws lambda list-event-source-mappings \
  --function-name jdlab-scan-ingest --query 'EventSourceMappings[0].UUID' --output text --region $REGION)" --region $REGION
aws events remove-targets --rule jdlab-scan-fanout --ids convert ingest --region $REGION
aws events delete-rule --name jdlab-scan-fanout --region $REGION
aws lambda delete-function --function-name jdlab-scan-ingest --region $REGION
aws lambda delete-function --function-name jdlab-scan-convert --region $REGION
aws sqs delete-queue --queue-url "$QUEUE_URL" --region $REGION
aws sqs delete-queue --queue-url "$DLQ_URL" --region $REGION
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
- **Event-shape:** both Lambdas parse EventBridge `detail.*` AND classic
  `Records[].s3`. A convert build that only reads `Records` no-ops on real
  uploads (`converted:0`) but "works" on a manual `{Records:[]}` invoke.
- **SQS policy** must be a stringified JSON attribute map via `jq` — the
  `Key=Value` shorthand breaks on the policy's commas.
- **CloudShell HOME is 1 GB** → build in `/tmp` (`--cache /tmp/.npmcache`).
- **Convert deploy via S3** (`--s3-bucket/--s3-key`); `--zip-file` inline caps at
  50 MB. Ingest is tiny → inline `--zip-file` is fine.
- **VisibilityTimeout ≥ Lambda timeout** (330 ≥ 300).
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
