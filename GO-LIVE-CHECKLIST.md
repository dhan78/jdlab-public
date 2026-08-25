# Go-Live Checklist — Dentist Pilot

The gate to putting **real patient cases** in front of a dentist. Ordered by what
actually blocks a pilot. Tags: **[legal]** contract/policy, **[ops]** infra/process,
**[code]** application change, **[verify]** confirm an existing setting.

> Scope: a **controlled pilot** with 1–2 known practices — not a public launch.
> The manufacturing pipeline (jobs → agent → mill) is **not** a blocker and can
> mature after live cases exist.

---

## Gate 1 — HIPAA / PHI (the hard blocker)

Patient names, tooth refs, surgery dates, and scans are PHI. None of the rest
matters until this is done.

- [ ] **[legal]** Sign the **AWS BAA** (AWS Artifact → accept the BAA for the account holding the DB + S3).
- [ ] **[legal]** Sign a **BAA with each pilot dentist** — you are their *business associate*. Have a template ready.
- [ ] **[legal]** **Email provider BAA** — this app sends receipts/notifications via **Microsoft Graph (Outlook)**; confirm the Microsoft 365 tenant is covered by a Microsoft BAA (enterprise agreement) *or* switch to a HIPAA-eligible sender.
- [ ] **[verify]** **S3 encryption at rest** — bucket **default SSE** enabled (SSE-S3 or SSE-KMS) on the scan + attachment buckets.
- [ ] **[verify]** **Postgres encryption at rest** — the DB volume/instance is encrypted.
- [ ] **[verify]** **TLS everywhere** — portal is HTTPS-only; presigned S3 URLs are `https`; no plaintext hops.
- [ ] **[verify]** **Audit coverage** — the `audit_log` table already records `case.view`, status changes, deletes, ingest, jobs. Confirm every PHI *read* path writes an audit row.
- [ ] **[legal/ops]** **Data retention & deletion policy** — how long cases live, and a working hard-delete (the admin case purge already wipes DB + S3; document it).
- [ ] **[legal]** **Breach-notification process** written down (who, what, within what window).
- [ ] **[code]** **PHI stays out of telemetry** — already the rule (ext/size/status only, never names/filenames); add a quick review that no new event leaks PHI.

## Gate 2 — Deploy / resilience (the fragility blocker)

Today: two divergent branches, a prebuilt image, migrations applied by hand.

- [ ] **[ops]** **Collapse to one source branch.** `feature/initial-snapshot` and `001-doctors-portal` share **no common ancestor** and are synced by hand — pick one canonical branch and retire the other.
- [ ] **[ops]** **CI build → deploy** on merge (image build + push + container recreate), not manual.
- [ ] **[ops]** **Migrate-on-deploy** — run `drizzle-kit migrate` (or a migrate step) automatically before the new image serves traffic. Migrations `0013`/`0014` are applied locally but there's no automated apply.
- [ ] **[ops]** **Automated Postgres backups** (daily + PITR if possible) and a **restore drill** you've actually run once.
- [ ] **[verify]** **S3 durability** — versioning on the scan/attachment buckets so a bad delete is recoverable.
- [ ] **[ops]** **Uptime + error alerting** — a health check and a channel that pages you when the portal 5xxes or the DB is down.
- [ ] **[ops]** **Secrets management** — `.env.local`/prod secrets in a real store (SSM/secrets manager), not on disk.

## Gate 3 — Auth hardening

- [ ] **[code]** **Admin MFA** (at least for `admin`/`planner` roles).
- [ ] **[code]** **Login lockout / throttle** on repeated failures (rate-limit exists; confirm it covers `/portal/login`).
- [ ] **[verify]** **Session security** — cookies `HttpOnly` + `Secure` + `SameSite`; sensible expiry.
- [ ] **[code]** **Password policy** — minimum strength on set/reset.

## Gate 4 — Pilot mechanics

- [ ] **[ops]** Pick **1–2 design-partner dentists** you already have a relationship with.
- [ ] **[ops]** **Scanner → bucket on-ramp proven** for *their* scanner (iTero / 3Shape / Medit) → the `scans/raw/` prefix that triggers ingestion.
- [ ] **[ops]** **Onboarding**: create the practice, map the doctor, a 1-page "how to drop a pin / approve a design" guide.
- [ ] **[ops]** **Support channel** — how they reach you when something breaks, and who responds.
- [ ] **[code/ops]** **Telemetry review dashboard** — you already emit `case_open`, `scan_view`, `annotation_*`, `message_send`, `design_approved`; make sure you can read pilot usage to show ROI.

---

## Not blocking the pilot (defer)

- Manufacturing automation (jobs → **lab agent** → mill). Built and indexed, but
  run milling manually behind the scenes until the comms pilot proves out.
- Milling **batching** — unnecessary at 2–3 cases/day; batch-of-1 + the CAM's
  disc-remnant tracking is correct for now.
- General availability / marketing to cold dentists.

## Suggested order

1. **Gate 1** items in parallel with **Gate 2** (legal can run while you do infra).
2. **Gate 3** (small code changes).
3. **Gate 4**, then run 20–30 real cases on the **comms portal** before touching
   manufacturing automation or onboarding more practices.

---

## Appendix — Process flow (swimlane)

Lanes are actors; time flows **downward**; `─►` / `◄─` are hand-offs across lanes.
The **comms portal** (Gate-ready) is the left/middle; the **manufacturing** half
(right lane, deferred) is bridged by the on-prem lab agent.

```
  DENTIST                     │  PORTAL · CLOUD                  │  LAB · on-prem
──────────────────────────────┼──────────────────────────────────┼──────────────────────────────
  scan patient                │                                  │
  upload → S3 scans/raw ──────┼─►  ingest (EventBridge → Lambda) │
                              │       └► CASE created            │
                              │          + GLB previews          │
                              │              │                   │
  view scan · drop pins  ◄────┼───  async collaboration  ────────┼─►  view scan · drop pins
  add tooth · SHADE           │       thread (dentist ⇄ lab)     │    design restoration in CAD
  approve design  ◄───────────┼──────────────────────────────────┼──  upload DESIGN file
                              │              │                   │
                              │   lab enqueues approved design   │
                              │   job (queued):                  │
                              │   DL-0007__14__A2__j42__crown.stl │
                              │              │                   │
                              │   jobs feed + presigned URL ◄────┼──  agent: poll (token)
                              │              ────────────────────┼─►  agent: download → atomic drop
                              │                                  │        └► C:\CAM\INBOX\
                              │                                  │    CAM: nest on disc + sprues
                              │                                  │    mill / print → sinter/cure → QC
                              │   job status (+ audit)  ◄────────┼──  agent: report done / error
                              │              │                   │
  DENTIST  ◄──────────────────┼───  ship notification  ──────────┼──  ship restoration
```

**Automated:** ingest, GLB previews, job enqueue → feed → agent download/drop/status.
**Human / skilled:** async review + approval, **CAD design**, **CAM nesting + sprues**,
and **mill / sinter / finish / QC** — the craft that decides quality.

> Everything in the **LAB** lane below "enqueue" is the deferred manufacturing
> pipeline — real, built, and indexed, but run manually until the comms pilot proves out.
