"""JD Dental Lab — scan ingestion worker.

Polls a pluggable source for new scans, creates a case in the portal via the
token-guarded ingest API (which uploads the scan to S3 and fires the GLB
conversion Lambda), and remembers what it's processed. Idempotent end-to-end.

Run:  python -m ingestion.worker      (or the container CMD)
Env:  see config.py.
"""
from __future__ import annotations

import logging
import os
import signal
import sys
import time
import types

from .config import Config
from .ledger import Ledger
from .portal_client import PortalClient, UnmappedError
from .sources.base import Source

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("ingest.worker")

_stop = False


def _handle_signal(signum: int, _frame: types.FrameType | None) -> None:
    global _stop
    log.info("received signal %s — finishing current cycle then exiting", signum)
    _stop = True


def build_source(cfg: Config) -> Source:
    if cfg.source == "s3":
        from .sources.s3_source import S3Source

        return S3Source(
            bucket=cfg.s3_bucket,
            prefix=cfg.s3_prefix,
            processed_prefix=cfg.s3_processed_prefix,
            quarantine_prefix=cfg.s3_quarantine_prefix,
            default_doctor_email=cfg.default_doctor_email,
            region=cfg.aws_region,
        )
    from .sources.local_source import LocalSource

    return LocalSource(
        inbox=cfg.local_dir,
        processed=cfg.local_processed_dir,
        quarantine=cfg.local_quarantine_dir,
        default_doctor_email=cfg.default_doctor_email,
    )


def run_once(source: Source, portal: PortalClient, ledger: Ledger) -> int:
    """Process everything currently waiting. Returns the number ingested."""
    ingested = 0
    for case in source.poll():
        if ledger.seen(case.external_id):
            continue
        try:
            case_id, created = portal.create_case(case)
        except UnmappedError as exc:
            # Can't route to a doctor — move it aside for a human, don't retry.
            log.warning("QUARANTINE %s (%s)", case.external_id, exc)
            try:
                source.quarantine(case)
            except Exception as qexc:  # noqa: BLE001
                log.error("quarantine failed for %s: %s", case.external_id, qexc)
            ledger.mark(case.external_id)
            continue
        except Exception as exc:  # noqa: BLE001 — one bad item must not stop the loop
            log.error("FAILED %s: %s", case.external_id, exc)
            continue
        ledger.mark(case.external_id)
        try:
            source.ack(case)
        except Exception as exc:  # noqa: BLE001
            log.warning("ack failed for %s (already ingested, will not re-create): %s", case.external_id, exc)
        log.info("%s %s -> case %s", "created" if created else "exists", case.external_id, case_id)
        ingested += 1
    return ingested


def main() -> int:
    cfg = Config.from_env()
    cfg.require()
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    source = build_source(cfg)
    portal = PortalClient(cfg.portal_base_url, cfg.ingest_token)
    ledger = Ledger(cfg.ledger_path)

    log.info(
        "ingestion worker up — source=%s portal=%s every %ss",
        cfg.source, cfg.portal_base_url, cfg.poll_seconds,
    )
    while not _stop:
        try:
            n = run_once(source, portal, ledger)
            if n:
                log.info("cycle complete — %s case(s) ingested", n)
        except Exception as exc:  # noqa: BLE001 — never let the loop die
            log.error("cycle error: %s", exc)
        # Sleep in short slices so a signal is honored promptly.
        for _ in range(max(1, cfg.poll_seconds)):
            if _stop:
                break
            time.sleep(1)
    log.info("ingestion worker stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
