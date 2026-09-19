# Build context is the REPOSITORY ROOT (see /railway.json). Leave Railway "Root Directory" empty.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY services/orchestrator/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY services/orchestrator/ ./

ENV PORT=8000 PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
