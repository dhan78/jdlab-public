"""Local-folder source: drop scan files into a watched directory.

Each model file (.stl/.ply/.obj/.zip) becomes one case. An optional sidecar
JSON (same basename + .json) supplies the doctor mapping + case metadata:

    scan.stl
    scan.json   ->  { "doctorEmail": "dr.foo@practice.com", "title": "Crown #14",
                      "toothRef": "14", "material": "zirconia", "caseType": "crown" }

Without a sidecar, the file uses INGEST_DEFAULT_DOCTOR_EMAIL and the filename as
the title. Processed files move to the processed/ subdir.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
from collections.abc import Iterator

from .base import ScanCase, Source, guess_mime, is_model_file

log = logging.getLogger("ingest.local")


class LocalSource(Source):
    def __init__(self, inbox: str, processed: str, quarantine: str, default_doctor_email: str) -> None:
        self._inbox = inbox
        self._processed = processed
        self._quarantine = quarantine
        self._default_doctor = default_doctor_email
        for d in (inbox, processed, quarantine):
            os.makedirs(d, exist_ok=True)

    def poll(self) -> Iterator[ScanCase]:
        skip = {os.path.abspath(self._processed), os.path.abspath(self._quarantine)}
        for root, dirs, files in os.walk(self._inbox):
            dirs[:] = [d for d in dirs if os.path.abspath(os.path.join(root, d)) not in skip]
            rel_dir = os.path.relpath(root, self._inbox)
            # A file inside a subfolder routes by that folder name (the practice key).
            practice_key = "" if rel_dir == "." else rel_dir.split(os.sep)[0]
            for name in sorted(files):
                if not is_model_file(name):
                    continue
                path = os.path.join(root, name)
                meta_path = os.path.splitext(path)[0] + ".json"
                meta: dict = {}
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path, "r", encoding="utf-8") as fh:
                            meta = json.load(fh)
                    except (json.JSONDecodeError, OSError):
                        log.warning("bad sidecar for %s — ignoring metadata", name)
                doctor = str(meta.get("doctorEmail") or self._default_doctor).strip().lower()
                if not doctor and not practice_key:
                    log.warning("skip %s: no doctorEmail, no practice folder, no default", name)
                    continue
                with open(path, "rb") as fh:
                    content = fh.read()
                yield ScanCase(
                    external_id=f"local:{os.path.relpath(path, self._inbox)}",
                    doctor_email=doctor,
                    practice_key=practice_key,
                    title=str(meta.get("title") or os.path.splitext(name)[0]),
                    filename=name,
                    content=content,
                    mime_type=guess_mime(name),
                    meta=meta,
                    _ack=(path, meta_path if os.path.exists(meta_path) else None),
                )

    def _move(self, case: ScanCase, dest_dir: str) -> None:
        path, meta_path = case._ack  # type: ignore[misc]
        for p in (path, meta_path):
            if p and os.path.exists(p):
                shutil.move(p, os.path.join(dest_dir, os.path.basename(p)))

    def ack(self, case: ScanCase) -> None:
        self._move(case, self._processed)

    def quarantine(self, case: ScanCase) -> None:
        self._move(case, self._quarantine)
