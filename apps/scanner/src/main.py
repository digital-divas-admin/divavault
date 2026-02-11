"""Scanner service entry point: FastAPI app + scheduler."""

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.config import settings
from src.db.connection import async_session, dispose_engine
from src.db.queries import get_scanner_metrics
from src.evidence.capture import shutdown_browser
from src.ingest.embeddings import init_model
from src.jobs.scheduler import run_scheduler
from src.jobs.store import PostgresJobStore
from src.utils.logging import get_logger, setup_logging

# Initialize logging
setup_logging()
log = get_logger("main")

# Track startup time for uptime calculation
_start_time = time.monotonic()
_scheduler_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    global _scheduler_task

    # Load InsightFace model once
    log.info("starting_scanner_service")
    init_model()

    # Start scheduler in background
    job_store = PostgresJobStore()
    _scheduler_task = asyncio.create_task(run_scheduler(job_store))
    log.info("scheduler_task_started")

    yield

    # Shutdown
    log.info("shutting_down_scanner_service")
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass

    await shutdown_browser()
    await dispose_engine()
    log.info("scanner_service_stopped")


app = FastAPI(
    title="Made Of Us Scanner",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    """Health check endpoint with operational metrics."""
    uptime = time.monotonic() - _start_time

    try:
        async with async_session() as session:
            metrics = await get_scanner_metrics(session)
    except Exception as e:
        metrics = {"error": str(e)}

    return {
        "status": "running",
        "uptime_seconds": round(uptime, 0),
        "metrics": metrics,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        log_level=settings.log_level.lower(),
    )
