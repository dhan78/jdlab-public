# S3 attachment upload — bucket setup (direct presigned-PUT)

Enables large attachments (exocad WebViewer HTML, full-arch STL/PLY, up to 150 MB) to upload
**straight from the browser to S3**, bypassing the app's 8 MB base64 body.

```
browser  --POST /attachments/presign-->  app (returns presigned PUT url)
browser  --PUT file-->  S3
browser  --POST message {s3Key}-->  app (verifies key + HeadObject size, stores key)
dentist  --opens case-->  app presigns a GET url  -->  ScanViewer/HtmlViewer/<img>
```

Same bucket already used for server-side attachments (`lib/storage.ts`). The **only** new
bucket-side requirement is **CORS**. Run these in AWS CloudShell (bash).

---

## 0. Variables

```bash
export AWS_REGION=us-east-1
export BUCKET=<your-attachment-bucket>          # same S3_BUCKET the app uses
export PORTAL_ORIGIN=https://portal.jdlab.us    # exact scheme+host (+port) of the portal
export APP_ROLE=<your-ec2-instance-role>        # role the app already runs as
```

---

## 1. CORS — the required change

The browser does a cross-origin **PUT** (upload) and the **STL/PLY viewer** does a cross-origin
**GET `fetch()`** of the bytes, so both methods must be allowed from the portal origin.
(The exocad **HTML** viewer frames the presigned URL directly — no `fetch`, so it needs only the
`text/html` content-type, which the app sets at PUT time; it does **not** rely on CORS.)

```bash
cat > /tmp/cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedMethods": ["PUT", "GET"],
      "AllowedOrigins": ["$PORTAL_ORIGIN"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration file:///tmp/cors.json

# verify
aws s3api get-bucket-cors --bucket "$BUCKET"
```

> Use the **exact** portal origin (scheme + host, and port if non-standard). Add more origins to
> the array for staging/localhost if you upload from those (e.g. `"http://localhost:3000"`).
> `AllowedHeaders: ["*"]` covers the `Content-Type` header the browser sends on PUT.

---

## 2. Default encryption (recommended)

Presigned PUTs don't sign an encryption header, so at-rest encryption comes from the bucket's
**default** SSE. Turn it on (SSE-S3) if it isn't already:

```bash
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

Also keep public access blocked:

```bash
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

---

## 3. IAM — app instance role

The app must generate presigned URLs and verify uploads. It likely already has S3 access for
server-side attachments; ensure it covers `PutObject`, `HeadObject`, `GetObject`, `DeleteObject`:

```bash
cat > /tmp/app-s3.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:PutObject","s3:GetObject","s3:HeadObject","s3:DeleteObject","s3:ListBucket","s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::$BUCKET","arn:aws:s3:::$BUCKET/*"] }
  ]
}
EOF

aws iam put-role-policy --role-name "$APP_ROLE" --policy-name attachment-s3 --policy-document file:///tmp/app-s3.json
```

> Presigning is a local crypto op (no S3 call), but `HeadObject` (upload verification) and the
> presigned **GET** on read both require these permissions on the role.

---

## 4. App environment

```bash
S3_BUCKET=<your-attachment-bucket>
AWS_REGION=us-east-1
# optional: S3_KEY_PREFIX=case-attachments/   (default already set in lib/storage.ts)
```

With `S3_BUCKET` set, `lib/storage.ts` `isS3Enabled()` is true → the presign route works and the
composer uploads directly. Without it (local dev), the composer falls back to inline base64 (8 MB).

---

## 5. Restart + verify

- **Restart the app** — the presign route (`app/api/portal/cases/[id]/attachments/presign/route.ts`)
  is a new file; Turbopack/standalone must be restarted to register it.
- In the portal, open a case and attach a large `.stl` or exocad `.html`:
  - Network tab: `POST …/attachments/presign` → `200`, then a `PUT` to `https://<bucket>.s3…` → `200`,
    then `POST …/messages` → `200`.
  - The dentist opens the case → the scan rotates / the exocad plan renders inline.
- If the PUT is blocked with a CORS error → re-check §1 (origin must match exactly).
- If the exocad HTML **downloads** instead of rendering → the object's `Content-Type` isn't
  `text/html`; the app sets it on PUT, so confirm the client sent it (Network → the PUT request
  headers).

---

## Notes

- **Caps:** 150 MB per file via presigned PUT; the legacy inline path stays at 8 MB. Server
  re-checks the real size with `HeadObject` — it never trusts the client-declared size.
- **Key scoping:** keys are `case-attachments/cases/<caseId>/<uuid>-<name>`; the messages route
  rejects any `s3Key` not under the case's own prefix.
- **exocad exports must be single self-contained HTML** (geometry embedded). A multi-file bundle
  won't work — only the one `.html` is uploaded, so relative sub-resource links would 404.

---

## 6. Optimized scan previews (GLB) — reading the scan bucket

The S3 conversion Lambda writes decimated GLBs to a **separate** bucket
(`jdlab-scans-prod-use1`) under `scans/glb/`. The portal resolves + presigns them
at **view time** (`resolveGlbPreviews` in `lib/storage.ts`) and the case thread
shows them inline. This needs config + its own read grant:

```bash
SCAN_BUCKET=jdlab-scans-prod-use1
AWS_REGION=us-east-1
# optional overrides (must match the Lambda's prefixes):
# SCAN_RAW_PREFIX=scans/raw/
# SCAN_GLB_PREFIX=scans/glb/
```

The portal's IAM role (EC2 instance role) needs **list + read** on the scan
bucket's GLB output — a *different* principal from the Lambda's role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "ListGlb", "Effect": "Allow", "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::jdlab-scans-prod-use1",
      "Condition": { "StringLike": { "s3:prefix": ["scans/glb/*"] } } },
    { "Sid": "ReadGlb", "Effect": "Allow", "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::jdlab-scans-prod-use1/scans/glb/*" }
  ]
}
```

Without `SCAN_BUCKET` set, `resolveGlbPreviews()` returns `[]` and the preview
panel simply doesn't render (local dev / no-S3 degrades cleanly). Previews only
resolve for **S3-ingested** cases (whose `scanCaseId` is `s3:<key>:<etag>`).
