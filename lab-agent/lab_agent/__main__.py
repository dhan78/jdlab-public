# Entry point: `python -m lab_agent`. Loads config, wires the real dependencies,
# and runs the poll loop until Ctrl-C / SIGTERM (responsive shutdown between polls).

from __future__ import annotations

import signal
import sys
import time
from datetime import datetime, timezone

from .agent import Agent
from .config import load_config
from .portal_client import PortalClient
from .state import load_state


def _load_dotenv() -> None:
    # Optional convenience for local dev; no hard dependency on python-dotenv.
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv()
    except Exception:
        pass


def main() -> int:
    _load_dotenv()
    cfg = load_config()

    def log(m: str) -> None:
        print(f"[agent] {datetime.now(timezone.utc).isoformat()} {m}", flush=True)

    log(f"starting - portal={cfg.portal_url} inbox={cfg.inbox_dir} poll={cfg.poll_seconds}s")

    portal = PortalClient(cfg.portal_url, cfg.api_token, log)
    state = load_state(cfg.state_file)
    agent = Agent(cfg, portal, state, log=log)

    stopping = {"v": False}

    def stop(signum, _frame) -> None:
        stopping["v"] = True
        log(f"signal {signum} - shutting down")

    signal.signal(signal.SIGINT, stop)
    try:
        signal.signal(signal.SIGTERM, stop)
    except (ValueError, AttributeError):
        pass  # SIGTERM isn't available in every Windows context

    while not stopping["v"]:
        try:
            agent.run_once()
        except Exception as e:  # never let a cycle error kill the loop
            log(f"cycle error: {e}")
        # Sleep in small slices so Ctrl-C is responsive between polls.
        slept = 0.0
        while slept < cfg.poll_seconds and not stopping["v"]:
            time.sleep(min(0.5, cfg.poll_seconds - slept))
            slept += 0.5

    log("stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
