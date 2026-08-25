# Local, file-backed idempotency log. It answers two questions across restarts:
#   * have I already dropped this job?                 (by_job_id)
#   * which job does a file in DONE/ERROR belong to?   (by_file_name -> job_id)
# Written atomically (temp file + os.replace) so a crash mid-write can't corrupt it.

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import asdict, dataclass, field
from typing import Dict, Optional


@dataclass
class JobRecord:
    job_id: str
    file_name: str
    case_id: Optional[str]
    status: str  # "dropped" | "done" | "error"
    updated_at: str


@dataclass
class AgentState:
    by_job_id: Dict[str, JobRecord] = field(default_factory=dict)
    by_file_name: Dict[str, str] = field(default_factory=dict)


def load_state(path: str) -> AgentState:
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        by_job = {k: JobRecord(**v) for k, v in (raw.get("byJobId") or {}).items()}
        return AgentState(by_job_id=by_job, by_file_name=dict(raw.get("byFileName") or {}))
    except (FileNotFoundError, ValueError, TypeError):
        return AgentState()


def save_state(path: str, state: AgentState) -> None:
    data = {
        "byJobId": {k: asdict(v) for k, v in state.by_job_id.items()},
        "byFileName": state.by_file_name,
    }
    directory = os.path.dirname(os.path.abspath(path)) or "."
    fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, path)  # atomic
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
