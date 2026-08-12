"""Runtime configuration for the ingestion worker (all from env / SSM)."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    # --- Portal target ---
    portal_base_url: str            # e.g. http://nextjs:3000 (in compose) or https://jdlab.us
    ingest_token: str               # matches the portal's INGEST_API_TOKEN

    # --- Worker behaviour ---
    source: str                     # 'local' | 's3'
    poll_seconds: int
    ledger_path: str
    default_doctor_email: str       # used when a source item carries no doctor mapping

    # --- Local source ---
    local_dir: str
    local_processed_dir: str
    local_quarantine_dir: str

    # --- S3 source ---
    s3_bucket: str
    s3_prefix: str
    s3_processed_prefix: str
    s3_quarantine_prefix: str
    aws_region: str

    @staticmethod
    def from_env() -> "Config":
        return Config(
            portal_base_url=os.environ.get("PORTAL_BASE_URL", "http://localhost:3000").rstrip("/"),
            ingest_token=os.environ.get("INGEST_API_TOKEN", ""),
            source=os.environ.get("INGEST_SOURCE", "local").strip().lower(),
            poll_seconds=int(os.environ.get("INGEST_POLL_SECONDS", "60")),
            ledger_path=os.environ.get("INGEST_LEDGER_PATH", "/var/lib/jdlab-ingest/seen.json"),
            default_doctor_email=os.environ.get("INGEST_DEFAULT_DOCTOR_EMAIL", "").strip().lower(),
            local_dir=os.environ.get("INGEST_LOCAL_DIR", "/inbox"),
            local_processed_dir=os.environ.get("INGEST_LOCAL_PROCESSED_DIR", "/inbox/processed"),
            local_quarantine_dir=os.environ.get("INGEST_LOCAL_QUARANTINE_DIR", "/inbox/unmapped"),
            s3_bucket=os.environ.get("INGEST_S3_BUCKET", ""),
            s3_prefix=os.environ.get("INGEST_S3_PREFIX", "intake/"),
            s3_processed_prefix=os.environ.get("INGEST_S3_PROCESSED_PREFIX", "processed/"),
            s3_quarantine_prefix=os.environ.get("INGEST_S3_QUARANTINE_PREFIX", "unmapped/"),
            aws_region=os.environ.get("AWS_REGION", "us-east-1"),
        )

    def require(self) -> None:
        if not self.ingest_token:
            raise SystemExit("INGEST_API_TOKEN is required (must match the portal).")
        if self.source not in ("local", "s3"):
            raise SystemExit(f"INGEST_SOURCE must be 'local' or 's3', got '{self.source}'.")
        if self.source == "s3" and not self.s3_bucket:
            raise SystemExit("INGEST_S3_BUCKET is required when INGEST_SOURCE=s3.")
