# The orchestration core, dependency-injected (portal / state / save / now) so it
# can be unit-tested with fakes and never has to touch the network or a real folder.

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Callable, Optional

from .config import Config
from .portal_client import PortalClient
from .sink import drop_file, list_files, remove_file, safe_name
from .state import AgentState, JobRecord, save_state


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Agent:
    def __init__(
        self,
        cfg: Config,
        portal: PortalClient,
        state: AgentState,
        *,
        log: Optional[Callable[[str], None]] = None,
        save: Callable[[str, AgentState], None] = save_state,
        now: Callable[[], str] = _now_iso,
    ):
        self._cfg = cfg
        self._portal = portal
        self._state = state
        self._log = log or (lambda m: print(f"[agent] {m}"))
        self._save = save
        self._now = now

    def pull_pending(self) -> None:
        for job in self._portal.list_pending():
            if job.job_id in self._state.by_job_id:
                continue  # already handled — idempotent across restarts
            try:
                file_name = safe_name(job.file_name)
                data = self._portal.download(job.download_url)
                drop_file(self._cfg.inbox_dir, file_name, data, self._cfg.part_suffix)
                self._state.by_job_id[job.job_id] = JobRecord(
                    job_id=job.job_id,
                    file_name=file_name,
                    case_id=job.case_id,
                    status="dropped",
                    updated_at=self._now(),
                )
                self._state.by_file_name[file_name] = job.job_id
                self._save(self._cfg.state_file, self._state)
                self._log(
                    f"dropped {file_name} -> {self._cfg.inbox_dir}"
                    + (f" (case {job.case_id})" if job.case_id else "")
                )
                self._portal.report_status(job.job_id, "dropped")
            except Exception as e:  # one bad job must not stop the batch
                self._log(f"failed to drop job {job.job_id}: {e}")

    def reconcile_outputs(self) -> None:
        self._scan(self._cfg.done_dir, "done")
        self._scan(self._cfg.error_dir, "error")

    def _scan(self, directory: Optional[str], status: str) -> None:
        if not directory:
            return
        for name in list_files(directory):
            job_id = self._state.by_file_name.get(name)
            if not job_id:
                continue  # unknown file — leave it for a human to look at
            rec = self._state.by_job_id.get(job_id)
            path = os.path.join(directory, name)
            if rec is None or rec.status == status:
                remove_file(path)  # already reported (or orphaned) — clear it
                continue
            rec.status = status
            rec.updated_at = self._now()
            self._save(self._cfg.state_file, self._state)
            self._portal.report_status(job_id, status)
            remove_file(path)
            self._log(f"{status}: {name}" + (f" (case {rec.case_id})" if rec.case_id else ""))

    def run_once(self) -> None:
        self.pull_pending()
        self.reconcile_outputs()
