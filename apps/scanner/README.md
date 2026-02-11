# Scanner Service

Face matching scanner for Made Of Us. Ingests contributor photos into a facial embedding registry and scans the internet for unauthorized use of contributors' faces.

## Architecture

- **Ingest**: Polls `contributor_images` and `uploads` for new photos, generates 512-dim ArcFace embeddings via InsightFace (buffalo_sc)
- **Discovery**: TinEye reverse image search + CivitAI platform crawling + user-submitted URL checks
- **Matching**: pgvector cosine similarity against the contributor embedding registry
- **Post-processing**: AI detection (Hive API), evidence capture (Playwright screenshots), DMCA notice drafting

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Copy env file and fill in values
cp .env.example .env

# Run locally
python -m src.main
```

## Docker

```bash
# Full stack (scanner + postgres + minio)
docker-compose up

# Build only
docker build -t scanner .
```

## Running Tests

```bash
pip install -r requirements-dev.txt
pytest tests/ -v
pytest tests/unit/ -v          # Fast, no external deps
pytest tests/integration/ -v   # Needs PostgreSQL
pytest tests/ --cov=src --cov-report=html
```

## Health Check

```
GET http://localhost:8000/health
```

Returns scanner status, uptime, and operational metrics.

## Environment Variables

See `.env.example` for all required variables.

## Key Design Decisions

- **Single process**: No message queues. PostgreSQL tables are the job queue via `SELECT FOR UPDATE SKIP LOCKED`.
- **CPU-only ML**: InsightFace buffalo_sc runs on CPU. Switch to buffalo_l or GPU via env var.
- **Tiered processing**: Free tier gets weekly reverse image scans and basic matching. Paid tiers get daily scans, AI detection, evidence capture, and takedown drafts.
- **pgvector**: Embedding comparison via PostgreSQL vector extension. No external vector DB needed at MVP scale.
