"""Source adapter interface. Add a new source (SFTP, iTero API, email) by
implementing `Source` — the worker and portal client stay unchanged."""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass, field


@dataclass
class ScanCase:
    external_id: str          # unique per source item — the idempotency key
    doctor_email: str         # explicit doctor mapping (wins over practice_key)
    title: str
    filename: str             # e.g. "scan.stl"
    content: bytes            # the raw scan bytes
    mime_type: str = "application/octet-stream"
    practice_key: str = ""    # source practice id -> doctor via the portal practice map
    meta: dict = field(default_factory=dict)  # caseType/toothRef/material/scannerBrand/isRush/...
    _ack: object = None       # opaque handle a source uses to finalize (move/delete)


class Source(ABC):
    @abstractmethod
    def poll(self) -> Iterator[ScanCase]:
        """Yield scan cases currently waiting. Cheap to call repeatedly."""
        raise NotImplementedError

    def ack(self, case: ScanCase) -> None:
        """Mark a case as processed at the source (e.g. move to processed/)."""
        # Optional — default no-op; the ledger still prevents re-ingest.
        return None

    def quarantine(self, case: ScanCase) -> None:
        """Move an un-ingestable item (unmapped practice / missing account) out of
        the poll path so it isn't retried forever, pending human attention."""
        # Default: fall back to ack so it doesn't loop; sources override to route
        # it to a dedicated unmapped/ area instead.
        self.ack(case)


MODEL_EXTS = {".stl", ".ply", ".obj", ".zip"}


def is_model_file(name: str) -> bool:
    lower = name.lower()
    return any(lower.endswith(ext) for ext in MODEL_EXTS)


def guess_mime(name: str) -> str:
    lower = name.lower()
    if lower.endswith(".stl"):
        return "model/stl"
    if lower.endswith(".ply"):
        return "application/octet-stream"
    if lower.endswith(".obj"):
        return "text/plain"
    if lower.endswith(".zip"):
        return "application/zip"
    return "application/octet-stream"
