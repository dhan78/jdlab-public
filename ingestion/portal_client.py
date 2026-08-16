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
    def __init__(
        self, base_url: str, token: str, inline_max_bytes: int = 6 * 1024 * 1024, timeout: int = 300
    ) -> None:
        self._url = f"{base_url}/api/ingest/cases"
        self._upload_url = f"{base_url}/api/ingest/upload-url"
        self._copy_url = f"{base_url}/api/ingest/copy-scan"
        self._token = token
        self._inline_max = inline_max_bytes
        self._timeout = timeout

    def _auth(self) -> dict:
        return {"Authorization": f"Bearer {self._token}"}

    def _presign_and_put(self, case: ScanCase) -> str:
        """Ask the portal for a presigned PUT, upload the bytes directly to S3,
        and return the storage key — no base64, no giant JSON body."""
        resp = requests.post(
            self._upload_url,
            json={"name": case.filename, "mimeType": case.mime_type},
            headers=self._auth(),
            timeout=self._timeout,
        )
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"upload-url API {resp.status_code}: {resp.text[:300]}")
        body = resp.json()
        key, url = body.get("key"), body.get("url")
        if not key or not url:
            raise RuntimeError("upload-url API returned no key/url")
        put = requests.put(
            url,
            data=case.content,
            headers={"Content-Type": case.mime_type or "application/octet-stream"},
            timeout=self._timeout,
        )
        if put.status_code not in (200, 201):
            raise RuntimeError(f"S3 PUT {put.status_code}: {put.text[:200]}")
        return key

    def _copy_from_s3(self, case: ScanCase) -> str:
        """Large scan already in S3: have the portal copy it server-side into the
        attachment space — no download + re-upload through the worker."""
        src_bucket, src_key = case.s3_ref  # type: ignore[misc]
        resp = requests.post(
            self._copy_url,
            json={"sourceBucket": src_bucket, "sourceKey": src_key, "name": case.filename},
            headers=self._auth(),
            timeout=self._timeout,
        )
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"copy-scan API {resp.status_code}: {resp.text[:300]}")
        key = resp.json().get("key")
        if not key:
            raise RuntimeError("copy-scan API returned no key")
        return key

    def _attachment(self, case: ScanCase) -> dict:
        """Route the scan by where it lives / how big it is:
          - already in S3 (any size) -> server-side copy into the attachment space
          - local & large            -> presigned direct PUT
          - local & small            -> inline base64
        """
        att: dict = {
            "name": case.filename,
            "mimeType": case.mime_type,
            "size": case.size or len(case.content),
        }
        if case.s3_ref is not None:
            att["storageKey"] = self._copy_from_s3(case)
        elif len(case.content) > self._inline_max:
            att["storageKey"] = self._presign_and_put(case)
        else:
            att["dataUrl"] = "data:{mime};base64,{b64}".format(
                mime=case.mime_type or "application/octet-stream",
                b64=base64.b64encode(case.content).decode("ascii"),
            )
        return att

    def create_case(self, case: ScanCase) -> tuple[str, bool]:
        """Create (or find) the case. Returns (caseId, created)."""
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
            "attachment": self._attachment(case),
        }
        resp = requests.post(
            self._url,
            json=payload,
            headers=self._auth(),
            timeout=self._timeout,
        )
        # 409 = unmapped practice, 422 = mapped email has no portal account.
        if resp.status_code in (409, 422):
            raise UnmappedError(f"{resp.status_code}: {resp.text[:200]}")
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"ingest API {resp.status_code}: {resp.text[:300]}")
        body = resp.json()
        return body.get("caseId", ""), bool(body.get("created"))
