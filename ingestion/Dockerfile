# syntax=docker/dockerfile:1
# JD Dental Lab — scan ingestion worker
FROM python:3.12-slim

# Non-root, no bytecode files, unbuffered logs.
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Package layout: /app/ingestion/*.py so `python -m ingestion.worker` works.
COPY . /app/ingestion/

# Ledger volume + drop privileges.
RUN mkdir -p /var/lib/jdlab-ingest \
 && useradd -r -u 10001 ingest \
 && chown -R ingest /var/lib/jdlab-ingest /app
USER ingest

CMD ["python", "-m", "ingestion.worker"]
