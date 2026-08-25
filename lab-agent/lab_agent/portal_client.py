# The only thing that talks to the cloud. The agent authenticates to the PORTAL
# with a scoped bearer token (no AWS credentials on this machine); the portal
# returns short-lived download URLs for approved job files and accepts status
# callbacks. Stdlib urllib only — the agent has no third-party runtime deps.

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable, List, Optional
from urllib import error, parse, request


@dataclass
class PendingJob:
    job_id: str
    case_id: Optional[str]
    file_name: str
    download_url: str


class PortalClient:
    def __init__(self, base_url: str, token: str, log: Callable[[str], None], *, timeout: int = 30):
        self._base = base_url.rstrip("/")
        self._token = token
        self._log = log
        self._timeout = timeout

    def list_pending(self) -> List[PendingJob]:
        url = f"{self._base}/api/ingest/jobs?status=pending"
        req = request.Request(url, headers={"Authorization": f"Bearer {self._token}"}, method="GET")
        with request.urlopen(req, timeout=self._timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        out: List[PendingJob] = []
        for j in payload.get("jobs") or []:
            job_id, file_name, download_url = j.get("jobId"), j.get("fileName"), j.get("downloadUrl")
            if not job_id or not file_name or not download_url:
                self._log(f"skipping malformed job entry: {j}")
                continue
            out.append(
                PendingJob(job_id=job_id, case_id=j.get("caseId"), file_name=file_name, download_url=download_url)
            )
        return out

    def download(self, url: str) -> bytes:
        # Absolute URL => a presigned S3 GET (self-authenticating; no token).
        # Relative path => a same-origin portal route (send the token).
        if url.startswith("http://") or url.startswith("https://"):
            req = request.Request(url, method="GET")
        else:
            req = request.Request(
                f"{self._base}{url}", headers={"Authorization": f"Bearer {self._token}"}, method="GET"
            )
        with request.urlopen(req, timeout=self._timeout) as resp:
            return resp.read()

    def report_status(self, job_id: str, status: str, detail: Optional[str] = None) -> None:
        url = f"{self._base}/api/ingest/jobs/{parse.quote(job_id, safe='')}/status"
        body = {"status": status}
        if detail:
            body["detail"] = detail
        req = request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=self._timeout) as resp:
                if resp.status >= 300:
                    self._log(f"status POST {resp.status} for job {job_id}")
        except error.URLError as e:  # best-effort: never let a status POST stall the loop
            self._log(f"status POST failed for job {job_id}: {e}")
