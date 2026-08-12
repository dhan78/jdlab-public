"""Idempotency ledger: remembers which source items we've already ingested.

Belt-and-suspenders — the portal ingest API is ALSO idempotent on externalId, so
a lost ledger can never create duplicates; the ledger just avoids re-POSTing.
"""
from __future__ import annotations

import json
import os
import tempfile
import threading


class Ledger:
    def __init__(self, path: str) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._seen: set[str] = set()
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as fh:
                    self._seen = set(json.load(fh))
            except (json.JSONDecodeError, OSError):
                self._seen = set()

    def seen(self, external_id: str) -> bool:
        return external_id in self._seen

    def mark(self, external_id: str) -> None:
        with self._lock:
            if external_id in self._seen:
                return
            self._seen.add(external_id)
            # Atomic write: temp file + rename, so a crash never truncates it.
            d = os.path.dirname(self._path) or "."
            fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    json.dump(sorted(self._seen), fh)
                os.replace(tmp, self._path)
            finally:
                if os.path.exists(tmp):
                    os.remove(tmp)
