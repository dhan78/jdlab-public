# JD Dental Lab — Scan Ingestion Worker

A small Python service that watches a **source** for new intraoral scans, creates
a case in the JD Lab portal via a token-guarded API, and lets the existing
**S3 → GLB conversion Lambda** take over. Runs on the EC2 box as its own
container. Idempotent end-to-end (a re-delivered scan never double-creates).

```
[source: local folder | S3 dropbox | (later) iTero API / SFTP / email]
      │  new scan detected
      ▼
  worker.py ── dedupe (ledger) ── POST /api/ingest/cases (Bearer token)
                                        │  portal creates case + attaches scan
                                        │  → scan lands in S3 → GLB Lambda converts
                                        ▼
                                 case visible in the portal, in 3D
```

## Why a token, not a login
The worker is **not** a doctor session. It authenticates to one dedicated
endpoint (`/api/ingest/cases`) with a static **service token** (`INGEST_API_TOKEN`,
from SSM) — so no scraping, no password automation, and the intake path is
isolated + auditable (`case.ingest` audit rows).

## Sources (pluggable)
Implement `sources/base.py::Source` to add one; the worker/portal don't change.
Shipped:
- **local** (`INGEST_SOURCE=local`) — drop files in `INGEST_LOCAL_DIR`. A file in a
  **subfolder** routes by that folder name as the *practice key* (e.g.
  `/inbox/lindqvist/scan.stl` → practice `lindqvist`). Optional sidecar
  `<name>.json` can also set `doctorEmail`, `title`, `toothRef`, `material`,
  `caseType`, etc. (an explicit `doctorEmail` wins over the practice key).
- **s3** (`INGEST_SOURCE=s3`) — objects under `s3://$INGEST_S3_BUCKET/$INGEST_S3_PREFIX`;
  the first path segment under the prefix is the practice key
  (`intake/lindqvist/scan.stl` → `lindqvist`). Object metadata
  (`x-amz-meta-doctor-email`, …) can override. Uses the EC2 instance role — no keys.

Deferred (drop in later, no rewrite): `itero_api` (Align Digital Platform, OAuth),
`sftp` (paramiko), `email`.

## How cases are assigned to a doctor
Assignment happens at ingest time. The portal resolves the target doctor as:
**explicit `doctorEmail` → else the `practiceKey` via the admin-managed practice
map** (Admin → "Scan ingestion — practice routing"). If neither resolves:
- **409 unmapped practice** or **422 no portal account** → the worker
  **quarantines** the item (moves it to the unmapped area) instead of retrying
  forever, pending a human mapping/onboarding. Nothing is auto-provisioned or
  silently dropped.


## Config (env / SSM `/jdlab/ingestion/`)
| var | default | purpose |
|---|---|---|
| `PORTAL_BASE_URL` | `http://localhost:3000` | portal base (`http://nextjs:3000` in compose) |
| `INGEST_API_TOKEN` | — (required) | must match the portal's `INGEST_API_TOKEN` |
| `INGEST_SOURCE` | `local` | `local` \| `s3` |
| `INGEST_POLL_SECONDS` | `60` | seconds between cycles |
| `INGEST_LEDGER_PATH` | `/var/lib/jdlab-ingest/seen.json` | dedupe ledger (persist on a volume) |
| `INGEST_DEFAULT_DOCTOR_EMAIL` | — | fallback doctor mapping |
| `INGEST_LOCAL_DIR` | `/inbox` | local source watch dir |
| `INGEST_S3_BUCKET` / `INGEST_S3_PREFIX` | — / `intake/` | S3 source |

`INGEST_API_TOKEN` must be set on **both** the portal (`nextjs`) and this worker.
Store it once in SSM and render into both env files.

## Run
Local dev:
```bash
cd ingestion
pip install -r requirements.txt
INGEST_API_TOKEN=dev-token PORTAL_BASE_URL=http://localhost:3000 \
INGEST_SOURCE=local INGEST_LOCAL_DIR=./inbox INGEST_DEFAULT_DOCTOR_EMAIL=dr.lindqvist@example.com \
INGEST_LEDGER_PATH=./seen.json python -m ingestion.worker
# then drop a .stl into ingestion/inbox/
```
Production: it runs as the `ingestion` service in `deploy/docker-compose.prod.yml`.

## Notes
- Big files: base64 over the ingest API is fine for typical scans (20–50 MB). For
  very large payloads (CBCT), extend the worker to PUT to S3 and pass `storageKey`
  instead of `dataUrl` (the ingest API already accepts it).
- The portal must have `INGEST_API_TOKEN` set or the endpoint returns `503`.
