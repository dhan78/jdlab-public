"""S3-dropbox source: practices (or an upstream integration) land scan files
under s3://<bucket>/<prefix>. Uses the EC2 instance role via IMDS — no keys.

Object metadata carries the doctor mapping + case fields (set on upload):
    x-amz-meta-doctor-email, x-amz-meta-title, x-amz-meta-tooth-ref,
    x-amz-meta-material, x-amz-meta-scanner-brand, x-amz-meta-case-type
Falls back to INGEST_DEFAULT_DOCTOR_EMAIL and the key's basename as the title.
Processed objects move to <processed_prefix>.
"""
from __future__ import annotations

import logging
import os
from collections.abc import Iterator

import boto3

from .base import ScanCase, Source, guess_mime, is_model_file

log = logging.getLogger("ingest.s3")


class S3Source(Source):
    def __init__(
        self,
        bucket: str,
        prefix: str,
        processed_prefix: str,
        quarantine_prefix: str,
        default_doctor_email: str,
        region: str,
    ) -> None:
        self._bucket = bucket
        self._prefix = prefix
        self._processed_prefix = processed_prefix.rstrip("/") + "/"
        self._quarantine_prefix = quarantine_prefix.rstrip("/") + "/"
        self._default_doctor = default_doctor_email
        self._s3 = boto3.client("s3", region_name=region)

    def poll(self) -> Iterator[ScanCase]:
        paginator = self._s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=self._prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.endswith("/") or not is_model_file(key):
                    continue
                if key.startswith(self._processed_prefix) or key.startswith(self._quarantine_prefix):
                    continue
                head = self._s3.head_object(Bucket=self._bucket, Key=key)
                meta = {k.lower(): v for k, v in head.get("Metadata", {}).items()}
                doctor = str(meta.get("doctor-email") or self._default_doctor).strip().lower()
                # Route by the first path segment under the intake prefix, e.g.
                # intake/lindqvist/scan.stl -> practice key 'lindqvist'.
                rel = key[len(self._prefix):] if key.startswith(self._prefix) else key
                practice_key = rel.split("/")[0] if "/" in rel else ""
                if not doctor and not practice_key:
                    log.warning("skip s3://%s/%s: no doctor-email and no practice prefix", self._bucket, key)
                    continue
                name = os.path.basename(key)
                # The scan is already in S3 — never download it. Pass an s3_ref so
                # the portal copies it server-side into the attachment space.
                yield ScanCase(
                    # etag makes re-uploads of a changed file a new case.
                    external_id=f"s3:{key}:{obj['ETag'].strip(chr(34))}",
                    doctor_email=doctor,
                    practice_key=practice_key,
                    title=str(meta.get("title") or os.path.splitext(name)[0]),
                    filename=name,
                    content=b"",
                    size=int(obj.get("Size", 0)),
                    s3_ref=(self._bucket, key),
                    mime_type=guess_mime(name),
                    meta={
                        "toothRef": meta.get("tooth-ref"),
                        "material": meta.get("material"),
                        "scannerBrand": meta.get("scanner-brand"),
                        "caseType": meta.get("case-type", "guide"),
                        "patientName": meta.get("patient-name"),
                    },
                    _ack=key,
                )

    def ack(self, case: ScanCase) -> None:
        self._relocate(case, self._processed_prefix)

    def quarantine(self, case: ScanCase) -> None:
        self._relocate(case, self._quarantine_prefix)

    def _relocate(self, case: ScanCase, dest_prefix: str) -> None:
        key = case._ack  # type: ignore[assignment]
        dest = dest_prefix + os.path.basename(key)
        self._s3.copy_object(
            Bucket=self._bucket, CopySource={"Bucket": self._bucket, "Key": key}, Key=dest
        )
        self._s3.delete_object(Bucket=self._bucket, Key=key)
