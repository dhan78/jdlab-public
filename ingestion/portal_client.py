"""Portal ingest client — POSTs a scan case to the token-guarded ingest API."""
from __future__ import annotations

import base64
import logging

import requests

from .sources.base import ScanCase

log = logging.getLogger("ingest.portal")


class UnmappedError(Exception):
    """The case can't be routed to a doctor (unmapped practice / no account).
    The worker quarantines these instead of retrying forever."""


class PortalClient:
    def __init__(self, base_url: str, token: str, timeout: int = 120) -> None:
        self._url = f"{base_url}/api/ingest/cases"
        self._token = token
        self._timeout = timeout

    def create_case(self, case: ScanCase) -> tuple[str, bool]:
        """Create (or find) the case. Returns (caseId, created)."""
        data_url = "data:{mime};base64,{b64}".format(
            mime=case.mime_type or "application/octet-stream",
            b64=base64.b64encode(case.content).decode("ascii"),
        )
        payload = {
            "externalId": case.external_id,
            "doctorEmail": case.doctor_email or None,
            "practiceKey": case.practice_key or None,
            "title": case.title,
            "caseType": case.meta.get("caseType", "guide"),
            "patientName": case.meta.get("patientName"),
            "toothRef": case.meta.get("toothRef"),
            "material": case.meta.get("material"),
            "scannerBrand": case.meta.get("scannerBrand"),
            "isRush": bool(case.meta.get("isRush", False)),
            "specialInstructions": case.meta.get("specialInstructions"),
            "attachment": {
                "name": case.filename,
                "mimeType": case.mime_type,
                "size": len(case.content),
                "dataUrl": data_url,
            },
        }
        resp = requests.post(
            self._url,
            json=payload,
            headers={"Authorization": f"Bearer {self._token}"},
            timeout=self._timeout,
        )
        # 409 = unmapped practice, 422 = mapped email has no portal account.
        if resp.status_code in (409, 422):
            raise UnmappedError(f"{resp.status_code}: {resp.text[:200]}")
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"ingest API {resp.status_code}: {resp.text[:300]}")
        body = resp.json()
        return body.get("caseId", ""), bool(body.get("created"))
