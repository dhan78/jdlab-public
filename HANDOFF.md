# JD Dental Lab Portal — Engineering Handoff & Strategy

> Purpose: let any engineer (or LLM assistant) resume this project instantly —
> the *what*, the *why*, the environment quirks, and the open threads. Read this
> top-to-bottom once; then use it as an index. Last updated: 2026-07 by the build assistant.

---

## 1. What this is

A **doctors' portal** bolted onto a Next.js marketing site for a digital dental lab.
Doctors submit cases and talk to the offshore lab team **per-case (async messaging)**;
the lab moves cases through a **status lifecycle** and ships. It supports three
disciplines: **surgical guides**, **fixed restorative** (crown/bridge/veneer/inlay/implant
crown), and **removable prosthetics** (dentures/partials), each with its own lifecycle.

The public marketing site (Hero, Services, etc.) predates the portal and is largely untouched.
All new work lives under `/portal`, `/app/api/portal`, and `lib/`.

### Product thesis (the "why")
The original ask was **video conferencing**. We deliberately steered to **async, per-case
messaging** instead, because the offshore lab works largely opposite hours to the US
dentists — a durable, threaded, attachment-rich case record is far more valuable than a
scheduled call. Video remains a future hook (a disabled "Call" button exists in the thread).

---

## 2. Environment & toolchain (corporate/locked machine — READ FIRST)

This was built on a JPMC-locked Windows machine. Key quirks (from `/memories/repo/environment.md`):

- **Node is not on PATH.** Installed via `ds tool install nodejs24`. Activate per shell:
  ```powershell
  $env:Path = "C:\Users\V032823\ds\tools\nodejs24\latest;" + $env:Path
  ```
- **Use `npm`, NOT `pnpm`.** Corepack/pnpm is blocked (public registry 403; Artifactory
  rejects unsigned metadata). npm points at the Artifactory mirror and works.
- **`sharp`** downloads corrupted from Artifactory — harmless for `npm run dev`, but must be
  fixed before a production `npm run build` (image optimization).
- Removed `@types/bcryptjs` (deprecated stub not in Artifactory; `bcryptjs` ships its own types).
- Docker images must come from **pre-mirrored** corporate tags (docker.io is blocked):
  - Postgres: `containerregistry-na.jpmchase.net/container-external/docker.io/postgres:17.5`
  - App base: `jetae-publish.prod.aws.jpmchase.net/container-base/managedbaseimages/nodejs:22-stable`
    (RHEL8 UBI, Node 22, runs as **root**, no `useradd`/shadow-utils).

**On a plain EC2 box** (not the corporate machine) most of this simplifies: normal Node install,
normal npm registry, normal `docker.io/postgres:17`. Adjust `docker-compose.yml` image refs and
the Dockerfile `npm config set registry` line accordingly.

### Run it (dev)
```powershell
$env:Path = "C:\Users\V032823\ds\tools\nodejs24\latest;" + $env:Path
cd <repo>
npm install
docker compose -p jdlab up -d postgres     # or point DATABASE_URL at any Postgres
npm run db:migrate     # apply versioned migrations (drizzle/*.sql) — prod-correct
npm run db:seed        # load demo data (TRUNCATEs case data, keeps users)
npm run dev            # http://localhost:3000
```
Scripts: `dev`, `build`, `start`, `lint`, `type-check`, `test`, `db:generate`, `db:migrate`,
`db:push`, `db:seed`. Seed uses `tsx --env-file=.env.local` (ESM import hoisting builds the pg
Pool before dotenv runs otherwise).

### Schema changes — versioned migrations (prod-correct)
Schema source of truth: `lib/db/schema.ts`. Workflow:
```
edit schema.ts  --db:generate-->  drizzle/NNNN_*.sql (+ meta/ snapshots, COMMIT these)  --db:migrate-->  live DB
```
- `npm run db:generate` — diffs schema vs the last `drizzle/meta` snapshot, writes a new SQL file.
  Review it (Drizzle can mistake a rename for drop+add — hand-edit if needed), then commit.
- `npm run db:migrate` — applies only not-yet-applied files, tracked in `drizzle.__drizzle_migrations`
  (idempotent — safe to run every deploy).
- `npm run db:push` — **dev only**, fast schema sync with no history. Do NOT use in prod
  (`--force` can silently drop columns). The repo was re-baselined onto migrations in 2026-07:
  `drizzle/0000_lazy_johnny_storm.sql` is the current full-schema baseline.

---

## 3. Stack & key decisions (the rationale)

| Decision | Why |
|---|---|
| **Next.js 15 App Router**, `output: 'standalone'` | Existing site; standalone for slim Docker image |
| **Drizzle ORM** (not Prisma) | Prisma needs engine-binary downloads that fail in the locked env; Drizzle is pure TS |
| **Postgres in Docker** | Real persistence; killed the old in-memory/stale-UUID papercut |
| **Sequential integer IDs** (not UUID) | Easy to browse in psql; URLs obfuscated separately (see §6) |
| **npm, not pnpm** | Corepack blocked in corp env |
| **Async messaging over video** | Offshore team works opposite hours; durable record > call |
| Status **"Production"** (not "Milling") | Guides are printed; "Milling" misdescribes them. Neutral term covers print+mill |
| **Client-safe `lib/case-meta.ts`** | Statuses/types/colors were triplicated across 3 client components; centralized (client components must NOT import `case-store` — it pulls in the DB layer) |
| **Case-URL obfuscation** (Feistel codec) | Hide sequential IDs in URLs without a DB slug column; zero frontend change |
| **S3 with base64 fallback** | Works in dev with no S3; uses EC2 IAM role in prod |

---

## 4. Architecture map

```
app/
  portal/(authenticated)/
    layout.tsx                    header/footer for the portal
    (cases)/layout.tsx            renders <CaseSidebar/> + {children}  (persists across nav)
    (cases)/page.tsx              -> /portal        (dashboard = CaseList)
    (cases)/cases/[id]/page.tsx   -> /portal/cases/[token]  (CaseThread)
    admin/page.tsx                -> /portal/admin  (no sidebar; account mgmt)
  api/portal/
    cases/route.ts                GET (role-scoped list), POST (doctor creates)
    cases/[id]/route.ts           GET (detail+thread), PATCH (status; planner/admin)
    cases/[id]/messages/route.ts  POST (message + attachments, 8MB cap)
    doctors/…, login, logout, forgot-password, reset-password, session
lib/
  case-meta.ts     ⭐ SHARED client-safe: CaseStatus, CaseType, STAGES_BY_TYPE, STATUS_META (colors), labels, groups
  case-store.ts    async DB repo for cases/messages; re-exports case-meta; encodes IDs; S3 wiring
  case-code.ts     reversible Feistel codec: encodeCaseId/decodeCaseId (URL obfuscation)
  portal-store.ts  async DB repo for users (doctors/planners) + reset tokens
  portal-auth.ts   bcrypt hashing, JWT session (jose), reset tokens
  storage.ts       S3 put/presign + base64 fallback (isS3Enabled)
  email.ts         Microsoft Graph mailer: reset + case message/status notifications (guarded)
  audit.ts         recordAudit() -> audit_log (best-effort, never throws)
  rate-limit.ts    in-memory fixed-window limiter (per-process)
  db/{index,schema,seed}.ts
components/
  CaseList.tsx       "My Cases"/"Work Queue": create form, filters/search, sort+scope SegmentedControls, StatusTracker
  CaseThread.tsx     thread + composer + image lightbox (pan/zoom) + status dropdown + scan-source chip
  CaseSidebar.tsx    "Upcoming": active + recently-shipped (2-day grace), sorted by surgery date, capped+scroll+"view all"
  StatusIcon.tsx     inline SVG icon per status (no icon library)
  SegmentedControl.tsx  reusable animated segmented control (sliding measured thumb)
```

### Roles
- **doctor** — sees own cases ("My Cases"); creates cases; posts messages.
- **planner** (offshore lab) — sees ALL cases ("Work Queue"); changes status.
- **admin** — account management at `/portal/admin`.
Authorization is enforced in the API (a doctor cannot read another doctor's case). The
middleware (`middleware.ts`) guards `/portal/*` and admin routes via the JWT cookie.

---

## 5. Case model: statuses, types, lifecycles

**Statuses** (`CaseStatus`, superset across disciplines):
`received → planning → design → review → production → tryin → finishing → shipped`

**Types** (`CaseType`) grouped in the UI:
- Surgical: `guide`
- Fixed restorative: `crown`, `bridge`, `veneer`, `inlay`, `implant_crown`
- Removable: `denture`, `partial`

**Per-type lifecycle** (`STAGES_BY_TYPE`):
- Guide: Received → **Planning** → Design → Review → Production → Shipped
- Fixed: Received → Design → Review → Production → Shipped  (no Planning)
- Removable: Received → Design → **Try-in → Finishing** → Shipped

**Colors** (deliberately muted; deep shades, tracker icons are light-tinted not solid):
Received slate · Planning blue · Design violet · Review amber · Production cyan ·
Try-in orange · Finishing teal · Shipped emerald. All in `STATUS_META` in `case-meta.ts`.

**Icons** (`StatusIcon.tsx`, inline SVG): Received=tray↓, Planning=crosshair, Design=person+monitor,
Review=person+check, Production=printer, Try-in=tooth, Finishing=sparkle, Shipped=truck.

**Case fields**: `title, patientName, surgeryDate, toothRef, material, scannerBrand, scanCaseId,
scanLink, specialInstructions, caseType, isRush, status`. `caseNumber` = `DL-{padded id}`
(derived, display-only). `specialInstructions` is the free-text Rx note (shown as an amber
callout on the case detail). Scans arrive via the scanner's own cloud portal
(iTero/3Shape/Medit) — the lab references the order ID; files are not uploaded here (except
message attachments).

---

## 6. Notable implementations

- **URL obfuscation** (`case-code.ts`): DB keeps integer IDs; `mapCase` exposes `id` as a 7-char
  token via a keyed 32-bit **Feistel permutation** (seeded from `PORTAL_JWT_SECRET`). Every store
  entry point decodes. Zero frontend change (IDs were already opaque strings). It's *obfuscation,
  not authorization* — real protection is the API ownership check. Tested: round-trips 1..5000.
- **Attachments/S3** (`storage.ts` + `case-store.ts`): on write, if `S3_BUCKET` set → upload
  (SSE-AES256), store `storage_key`; else base64 in `data_url`. On read, presign the key into the
  `dataUrl` the client already expects (15-min URL). IAM role provides creds — no keys in code.
- **Email** (`email.ts`): Microsoft Graph. New message notifies the other party; status change
  notifies the doctor. Fire-and-forget, guarded by `isEmailConfigured()` (no-op in dev).
- **Audit** (`audit.ts` + `audit_log` table): login success/failure, case view/create/status change,
  message create, password-reset request. Best-effort, never throws.
- **Rate limiting** (`rate-limit.ts`): in-memory fixed window (per-process — move to Redis for
  multi-instance). Applied to message posting; login/forgot have their own.
- **Security headers** (`next.config.ts`): nosniff, X-Frame-Options DENY, Referrer-Policy,
  Permissions-Policy; HSTS in prod. Strict CSP intentionally deferred (needs nonce wiring).
- **Sidebar collapsing** (`CaseSidebar.tsx`): shows active + shipped-within-2-days (grace), sorted
  by soonest surgery date, capped at 12 with scroll + "View all N →". `SHIPPED_GRACE_DAYS = 2`.
- **List controls** (`CaseList.tsx`): search; status/type/rush filters; **scope** SegmentedControl
  (Active default / Shipped / All — not persisted, resets to Active); **sort** SegmentedControl
  (Recently updated / Surgery date — persisted in `localStorage` key `jdlab.caseSort`).
- **SegmentedControl.tsx**: sliding thumb measured from the active button (handles variable widths),
  animates via `transition-all`, respects `prefers-reduced-motion`, `role=tablist`.
- **Cross-view sync**: `window` event `cases:changed` on create (CaseList) + status change
  (CaseThread); CaseSidebar refetches on it.

---

## 7. Environment variables

Required: `PORTAL_JWT_SECRET`, `DATABASE_URL`, `PORTAL_ADMIN_EMAIL/NAME/PASSWORD` (seeds admin).
Optional (degrade gracefully):
- S3: `S3_BUCKET`, `AWS_REGION`, `S3_KEY_PREFIX` (IAM role gives creds). Configured in the
  `nextjs` service `environment:` in `docker-compose.yml`.
- Email: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `NEXT_PUBLIC_BASE_URL`,
  `LAB_NOTIFY_EMAIL`.

**Demo logins (dev only):** doctor `dr.lindqvist@example.com` / `demopass1234` ·
planner `planner@jdlab.us` / `demopass1234` · admin `admin@jdlab.us` / `mgdnpass`.
Extra seeded doctors (case owners, same password): chalak, kuznetsov, salem, mcvety `@example.com`.

---

## 8. Deploy on EC2 (SSM-based; no open SSH/RDP)

The whole stack is `docker compose` (postgres + nextjs + caddy). Access the box via **AWS SSM**
(SSH port 22 removed; only 443/80 inbound for Caddy). Deploy:
```bash
aws ssm start-session --target <instance-id> --region <region>
cd /opt/jdlab && git pull origin main
docker compose -p jdlab build nextjs
docker compose -p jdlab up -d
docker compose -p jdlab exec nextjs npm run db:migrate    # apply any new migrations (idempotent)
```
- **TLS**: `Caddyfile` does automatic HTTPS (Let's Encrypt) → `nextjs:3000`. App sets a **Secure**
  cookie in production, so auth only fully works behind HTTPS/Caddy (dev :3000 http is fine).
- Non-interactive `send-command` deploys need `docker compose exec -T` (no TTY).
- Caddy/Postgres containers usually don't need rebuilding — just `nextjs`.

---

## 9. Gotchas (things that will bite you)

- **Client components must not import `lib/case-store.ts`** (it imports `db`/pg). Import shared
  constants from `lib/case-meta.ts` instead. This is why case-meta exists.
- **Secure cookie over plain HTTP**: containerized app (`NODE_ENV=production`) sets Secure cookies →
  login works but authed routes 401 over `http://`. Use Caddy/HTTPS. Dev server (:3000) is http, fine.
- **Seed is destructive-ish**: `db:seed` does `TRUNCATE cases, case_messages, message_attachments,
  case_status_history RESTART IDENTITY CASCADE` (users preserved via getOrCreateUser). Fine for
  dev/demo; never point it at real data.
- **`db:push` is dev-only**: it syncs schema with no history and `--force` can drop columns. Prod
  uses **versioned migrations** (`db:generate` to author, `db:migrate` to apply). See §2.
- **Message IDs** are text `"{caseId}-{n}"` using the *integer* case id — they appear in JSON
  payloads (not URLs). If full ID hiding matters, encode these too.
- **Rate limiter & audit** are per-process/in-memory or single-DB — fine for one box; revisit for
  multi-instance (Redis; the audit table is already shared via Postgres).

---

## 10. Open threads / roadmap (prioritized)

**Compliance (this app stores PHI — patient names + clinical data):**
- Sign BAAs (hosting/DB/email/S3). Encryption at rest + in transit. Data retention/deletion policy.
- Extend audit to record *views* fully; add logout + doctor create/delete audit (helper ready).

**Security hardening:**
- Account lockout after N failed logins (currently IP-window only).
- Strict CSP with nonces. CSRF tokens on mutating routes. Secret manager for env.

**Storage/comms:**
- **Direct browser→S3 presigned PUT** for large CBCT/STL (bypass the 8MB base64 body).
- Delete-from-S3 on case/message deletion (helper `deleteAttachment` exists; nothing calls it).
- S3 lifecycle policy + virus scanning.

**Workflow depth:**
- **Removable multi-round try-in tracking**: real dentures/partials ping-pong clinic↔lab across
  appointments (impression → tray → bite rim → wax try-in → adjust → process → deliver). Current
  `tryin`/`finishing` are single stages; a per-stage history/round-trip UI would model it truly.
- Remakes/adjustments tracking (warranty remakes are a big lab concern).
- Per-unit pricing/invoicing; shade + tooth-chart fields; practices/offices with standing ship-to.

**Ops:**
- Fix `sharp` before production `npm run build`.
- Observability (Sentry), DB backups + restore drills, staging vs prod separation.
- Zero-downtime deploy (two app replicas + Caddy LB) — currently `up -d` has a ~1-2s blip.

**Tests** (`tests/`, vitest — `npm test`): currently case-code round-trip + rate-limiter.
Add: API authorization (cross-doctor access denied), status transitions, auth flows.

---

## 11. Where to look first when resuming
1. This file.
2. `lib/case-meta.ts` — the shape of the domain (statuses/types/lifecycles/colors).
3. `lib/case-store.ts` + `app/api/portal/cases/**` — the server behavior.
4. `components/CaseList.tsx` — most of the UX (filters, sort/scope, tracker).
5. `lib/db/seed.ts` — realistic demo data (surgical-guide + fixed + removable cases).
