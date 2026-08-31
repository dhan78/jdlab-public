# Central config, loaded once from the environment. Fails fast with a clear
# message if a required value is missing, so a misconfigured lab PC surfaces the
# problem immediately instead of silently doing nothing.

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping, Optional


@dataclass(frozen=True)
class Config:
    portal_url: str
    api_token: str
    inbox_dir: str
    done_dir: Optional[str]
    error_dir: Optional[str]
    poll_seconds: float
    state_file: str
    part_suffix: str = ".part"


def load_config(env: Optional[Mapping[str, str]] = None) -> Config:
    env = env if env is not None else os.environ

    def req(name: str) -> str:
        v = env.get(name)
        if not v or not v.strip():
            raise RuntimeError(f"Missing required env {name}")
        return v.strip()

    def opt(name: str) -> Optional[str]:
        v = env.get(name)
        return v.strip() if v and v.strip() else None

    try:
        poll = float(env.get("AGENT_POLL_SECONDS", "15") or "15")
    except ValueError:
        poll = 15.0

    return Config(
        portal_url=req("AGENT_PORTAL_URL").rstrip("/"),
        api_token=req("AGENT_API_TOKEN"),
        inbox_dir=req("AGENT_INBOX_DIR"),
        done_dir=opt("AGENT_DONE_DIR"),
        error_dir=opt("AGENT_ERROR_DIR"),
        poll_seconds=max(2.0, poll),
        state_file=opt("AGENT_STATE_FILE") or os.path.abspath("agent-state.json"),
    )
