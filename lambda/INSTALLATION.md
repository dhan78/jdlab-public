# Ingest Lambda + EventBridge — CloudShell installation

Copy-paste runbook to install the **event-driven scan ingest** (EventBridge
fan-out → SQS → `jdlab-scan-ingest` Lambda) from **AWS CloudShell** in
`us-east-1`. This wires the existing `jdlab-scan-convert` Lambda as a second
fan-out target too, so one `scans/raw/` upload triggers both convert and ingest
with **no polling**.

> The only file you upload is [`ingest-case.mjs`](ingest-case.mjs) — every IAM
> policy / queue policy / event pattern below is inlined as a heredoc, so nothing
> else needs to come from the repo. The handler has **no dependencies**
> (`@aws-sdk/client-s3` + `fetch` are in the Node 22 runtime), so there's no
> build step.

---

## 0. Prerequisites (run once per CloudShell session)

Open CloudShell in **us-east-1**, then:

```bash
export AWS_PAGER=""
SCAN_BUCKET=jdlab-scans-prod-use1
REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
PORTAL_BASE_URL=https://jdlab.us

# Pull the ingest token from SSM (same token the portal validates) — never paste it.
INGEST_API_TOKEN=$(aws ssm get-parameter --name /jdlab/INGEST_API_TOKEN \
  --with-decryption --query Parameter.Value --output text --region "$REGION")

echo "account=$ACCOUNT_ID bucket=$SCAN_BUCKET region=$REGION"
```

Upload the handler via **Actions ▸ Upload file** (drops into `~`):

- `ingest-case.mjs`  (from the repo `lambda/` folder)

---

## 1. Turn on EventBridge notifications for the bucket

```bash
aws s3api put-bucket-notification-configuration --bucket "$SCAN_BUCKET" \
  --notification-configuration '{"EventBridgeConfiguration":{}}'
```

> This overwrites the bucket's notification config with **EventBridge-only**, so
> any old direct S3→Lambda trigger that pointed at `jdlab-scan-convert` is
> removed here (conversion now runs as an EventBridge target in step 4 — no
> double-trigger).

---

## 2. Create the DLQ + ingest queue (redrive after 5 receives)

```bash
DLQ_URL=$(aws sqs create-queue --queue-name jdlab-scan-ingest-dlq \
  --attributes MessageRetentionPeriod=1209600 \
  --query QueueUrl --output text --region "$REGION")
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "$DLQ_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text --region "$REGION")

QUEUE_URL=$(aws sqs create-queue --queue-name jdlab-scan-ingest --attributes "$(cat <<JSON
{ "VisibilityTimeout": "330",
  "MessageRetentionPeriod": "345600",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"5\"}" }
JSON
)" --query QueueUrl --output text --region "$REGION")
QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url "$QUEUE_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text --region "$REGION")

echo "queue=$QUEUE_ARN"
echo "dlq=$DLQ_ARN"
```

> `VisibilityTimeout` (330 s) must be **≥ the Lambda timeout** (300 s) + margin.

---

## 3. Let EventBridge send to the queue (queue resource policy)

```bash
cat > /tmp/queue-policy.json <<JSON
{ "Version": "2012-10-17", "Statement": [{
  "Sid": "AllowEventBridgeSend", "Effect": "Allow",
  "Principal": { "Service": "events.amazonaws.com" },
  "Action": "sqs:SendMessage", "Resource": "$QUEUE_ARN",
  "Condition": { "ArnEquals": {
    "aws:SourceArn": "arn:aws:events:$REGION:$ACCOUNT_ID:rule/jdlab-scan-fanout" } } }]}
JSON

aws sqs set-queue-attributes --queue-url "$QUEUE_URL" --region "$REGION" \
  --attributes "$(jq -n --arg p "$(cat /tmp/queue-policy.json)" '{Policy:$p}')"
```

---

## 4. Create the EventBridge rule + both targets

```bash
cat > /tmp/pattern.json <<JSON
{ "source": ["aws.s3"], "detail-type": ["Object Created"],
  "detail": { "bucket": { "name": ["$SCAN_BUCKET"] },
              "object": { "key": [{ "prefix": "scans/raw/" }] } } }
JSON

aws events put-rule --name jdlab-scan-fanout --region "$REGION" \
  --event-pattern file:///tmp/pattern.json

# Target 1 = existing conversion Lambda; Target 2 = the ingest SQS queue.
aws events put-targets --rule jdlab-scan-fanout --region "$REGION" --targets \
  "Id=convert,Arn=arn:aws:lambda:$REGION:$ACCOUNT_ID:function:jdlab-scan-convert" \
  "Id=ingest,Arn=$QUEUE_ARN"

# Allow the rule to invoke the conversion Lambda (the queue perm was step 3).
aws lambda add-permission --function-name jdlab-scan-convert \
  --statement-id eb-fanout --action lambda:InvokeFunction \
  --principal events.amazonaws.com --region "$REGION" \
  --source-arn arn:aws:events:$REGION:$ACCOUNT_ID:rule/jdlab-scan-fanout
```

---

## 5. IAM role for the ingest Lambda

```bash
cat > /tmp/trust.json <<'JSON'
{ "Version": "2012-10-17", "Statement": [{
  "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" },
  "Action": "sts:AssumeRole" }]}
JSON

cat > /tmp/ingest-lambda-policy.json <<JSON
{ "Version": "2012-10-17", "Statement": [
  { "Sid": "HeadRawScans", "Effect": "Allow", "Action": ["s3:GetObject"],
    "Resource": "arn:aws:s3:::$SCAN_BUCKET/scans/raw/*" },
  { "Sid": "ConsumeIngestQueue", "Effect": "Allow",
    "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
    "Resource": "$QUEUE_ARN" }
]}
JSON

aws iam create-role --role-name jdlab-scan-ingest \
  --assume-role-policy-document file:///tmp/trust.json
aws iam attach-role-policy --role-name jdlab-scan-ingest \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name jdlab-scan-ingest \
  --policy-name ingest-perms --policy-document file:///tmp/ingest-lambda-policy.json
```

---

## 6. Deploy the ingest Lambda (single file — no build)

```bash
zip -j /tmp/ingest.zip ~/ingest-case.mjs

sleep 10   # let the fresh IAM role propagate before create-function

aws lambda create-function --function-name jdlab-scan-ingest \
  --runtime nodejs22.x --handler ingest-case.handler \
  --role arn:aws:iam::$ACCOUNT_ID:role/jdlab-scan-ingest \
  --zip-file fileb:///tmp/ingest.zip \
  --memory-size 256 --timeout 300 --architectures arm64 --region "$REGION" \
  --environment "Variables={PORTAL_BASE_URL=$PORTAL_BASE_URL,INGEST_API_TOKEN=$INGEST_API_TOKEN}"

aws lambda wait function-active --function-name jdlab-scan-ingest --region "$REGION"
```

---

## 7. Wire SQS → ingest Lambda (partial-batch failures)

```bash
aws lambda create-event-source-mapping --function-name jdlab-scan-ingest \
  --event-source-arn "$QUEUE_ARN" --batch-size 10 \
  --function-response-types ReportBatchItemFailures --region "$REGION"
```

`ReportBatchItemFailures` lets one bad message retry without re-running the whole
batch; after `maxReceiveCount` (5) it lands in `jdlab-scan-ingest-dlq`.

---

## 8. Verify

**Live tail the logs:**

```bash
aws logs tail /aws/lambda/jdlab-scan-ingest --follow --format short --region "$REGION"
```

**End-to-end:** upload a real scan and watch a case appear in the portal:

```bash
aws s3 cp some-scan.stl s3://$SCAN_BUCKET/scans/raw/lindqvist/some-scan.stl \
  --metadata doctor-email=dr.foo@practice.com,title="Crown #14",case-type=crown
```

**Or invoke the function directly with a synthetic event (no upload):**

```bash
cat > /tmp/ev.json <<JSON
{ "detail-type": "Object Created", "source": "aws.s3",
  "detail": { "bucket": { "name": "$SCAN_BUCKET" },
    "object": { "key": "scans/raw/lindqvist/test.stl", "etag": "abc123", "size": 1024 } } }
JSON

aws lambda invoke --function-name jdlab-scan-ingest \
  --payload file:///tmp/ev.json --cli-binary-format raw-in-base64-out \
  --region "$REGION" /tmp/out.json
cat /tmp/out.json
```

---

## Redeploy after a code change

```bash
zip -j /tmp/ingest.zip ~/ingest-case.mjs
aws lambda update-function-code --function-name jdlab-scan-ingest \
  --zip-file fileb:///tmp/ingest.zip --region "$REGION"
```

---

## Teardown (remove everything this installed)

```bash
aws lambda delete-event-source-mapping --uuid "$(aws lambda list-event-source-mappings \
  --function-name jdlab-scan-ingest --query 'EventSourceMappings[0].UUID' \
  --output text --region "$REGION")" --region "$REGION"
aws lambda delete-function --function-name jdlab-scan-ingest --region "$REGION"
aws events remove-targets --rule jdlab-scan-fanout --ids convert ingest --region "$REGION"
aws events delete-rule --name jdlab-scan-fanout --region "$REGION"
aws sqs delete-queue --queue-url "$QUEUE_URL" --region "$REGION"
aws sqs delete-queue --queue-url "$DLQ_URL" --region "$REGION"
aws iam delete-role-policy --role-name jdlab-scan-ingest --policy-name ingest-perms
aws iam detach-role-policy --role-name jdlab-scan-ingest \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name jdlab-scan-ingest
```

> This leaves the bucket on EventBridge notifications and the `jdlab-scan-convert`
> function untouched. To fully revert conversion to a direct S3 trigger you'd
> re-create a bucket notification for it.
