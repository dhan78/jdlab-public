# jdlab lab agent

On-prem bridge that pulls approved manufacturing jobs from the portal and drops
their files into the CAM/slicer **hot folder** a machine watches, then reports
status back. It runs on a PC inside the lab (ideally the mill/slicer control PC).

**No AWS credentials live on this machine.** The agent authenticates to the
portal with a scoped token; the portal hands back short-lived download URLs. The
milling machine itself never touches AWS or the API — it only reads local/LAN
files.

```
   INTERNET                         │   LAB LAN
                                    │
 ┌───────────────┐  HTTPS (token)  │   ┌───────────────────────────────┐
 │    Portal      │◀────────────────────│  Lab agent (this service)     │
 │  /api/ingest/  │  jobs + signed  │   │  1. poll portal for jobs      │
 │   jobs         │  download URLs  │   │  2. download file (HTTPS)     │
 └───────────────┘                  │   │  3. atomic-drop into INBOX    │
                                    │   │  4. watch DONE/ERROR          │
                                    │   │  5. POST status back          │
                                    │   └──────────────┬────────────────┘
                                    │                  ▼ writes file
                                    │   C:\CAM\INBOX\  →  CAM/slicer → machine
```

## Requirements

- **Python 3.9+** (tested on 3.11). Nothing else — the agent uses only the
  Python standard library (`urllib`, `os`, `json`, …). No `pip install` is
  strictly required to run it.
- Network: outbound HTTPS to the portal only. No inbound ports.

## Configure

Copy the example env file and fill it in:

```powershell
copy .env.example .env
```

| Variable | Required | Meaning |
| --- | --- | --- |
| `AGENT_PORTAL_URL` | yes | Base URL of the portal, e.g. `https://portal.example.com`. |
| `AGENT_API_TOKEN` | yes | Bearer token (the portal's `INGEST_API_TOKEN` family). |
| `AGENT_INBOX_DIR` | yes | Folder the CAM/slicer watches, local or UNC (`\\MILL-PC\CAM_INBOX`). |
| `AGENT_DONE_DIR` | no | Folder the CAM moves finished jobs to → reported as `done`. |
| `AGENT_ERROR_DIR` | no | Folder the CAM moves failed jobs to → reported as `error`. |
| `AGENT_POLL_SECONDS` | no | Poll interval (default 15, min 2). |
| `AGENT_STATE_FILE` | no | Local idempotency log (default `agent-state.json`). Keep it. |

> The agent loads `.env` automatically **only if** `python-dotenv` is installed
> (`pip install python-dotenv`). In production, set real environment variables
> instead (service env / Task Scheduler).

## Run

```powershell
python -m lab_agent
```

That's it — it polls, drops, watches, and reports until you stop it (Ctrl-C).

### Run as a background service (recommended for a lab PC)

- **Task Scheduler**: "At startup", action `python -m lab_agent`, start-in this
  folder, run whether logged in or not.
- **nssm** (Non-Sucking Service Manager): `nssm install jdlab-lab-agent` →
  program `python`, arguments `-m lab_agent`, startup dir this folder.

### Optional: single `.exe` (only for locked-down PCs with no Python)

```powershell
pip install pyinstaller
pyinstaller --onefile --name jdlab-lab-agent lab_agent/__main__.py
# dist\jdlab-lab-agent.exe
```

Use this **only** when you can't install Python on the machine — plain scripts
are the simpler default.

## How it works

1. **Poll** `GET {portal}/api/ingest/jobs?status=pending` → a list of
   `{ jobId, caseId, fileName, downloadUrl }`.
2. **Download** each file from `downloadUrl` (a short-lived presigned URL — no
   token needed; a relative path is fetched from the portal with the token).
3. **Atomic drop** into `AGENT_INBOX_DIR`: write `name.part`, then rename to
   `name`, so the CAM never sees a half-copied file.
4. **Report** `dropped` via `POST {portal}/api/ingest/jobs/{jobId}/status`.
5. **Reconcile** `AGENT_DONE_DIR` / `AGENT_ERROR_DIR`: when the CAM moves a job
   file there, report `done` / `error` and clear the file.

**Idempotency:** every handled job is recorded in the state file, so a restart
never re-drops or double-reports. The portal also only serves `queued` jobs, so
a dropped job won't be handed out again.

## Security notes

- Outbound HTTPS only; no inbound ports, no AWS credentials on the LAN.
- Scope `AGENT_API_TOKEN` to the ingest role only; rotate it if a lab PC is lost.
- The agent writes only into the configured hot folder; object names are
  sanitized (basename only) so a job can't path-traverse out of it.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Missing required env AGENT_PORTAL_URL` | `.env` not loaded — install `python-dotenv` or set real env vars. |
| Feed always empty | No `queued` jobs, or the portal has no S3 configured (it returns `[]` without a way to sign download URLs). |
| `401` on poll | `AGENT_API_TOKEN` doesn't match the portal's ingest token. |
| Files appear but CAM ignores them | Point `AGENT_INBOX_DIR` at the exact folder the CAM watches; confirm the file extension the CAM expects. |
| No `done`/`error` updates | Set `AGENT_DONE_DIR` / `AGENT_ERROR_DIR` to the folders the CAM moves finished jobs into. |

## Development

```powershell
python -m py_compile lab_agent/*.py   # syntax check (no deps needed)
```

The core (`agent.py`) is dependency-injected (`portal`, `state`, `save`, `now`),
so it can be unit-tested with fakes — no network, no real folders.
