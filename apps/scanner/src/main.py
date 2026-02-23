"""Scanner service entry point: FastAPI app + scheduler."""

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.config import settings
from src.db.connection import async_session, dispose_engine
from src.db.queries import get_ml_metrics, get_scanner_metrics, get_test_user_stats
from src.intelligence.observer import observer
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
_health_recommender = None


def _get_compute_info() -> dict:
    """Return compute/GPU status for the health endpoint."""
    gpu_available = False
    try:
        import onnxruntime
        gpu_available = "CUDAExecutionProvider" in onnxruntime.get_available_providers()
    except Exception:
        pass

    # Detect actual execution provider from the loaded InsightFace model
    execution_provider = "unknown"
    try:
        from src.providers import get_face_detection_provider
        provider = get_face_detection_provider()
        model = provider.get_model()
        for m in model.models.values():
            sess_providers = getattr(m, "providers", None) or (
                m.session.get_providers() if hasattr(m, "session") else []
            )
            if "CUDAExecutionProvider" in sess_providers:
                execution_provider = "CUDAExecutionProvider"
                break
            if "CPUExecutionProvider" in sess_providers:
                execution_provider = "CPUExecutionProvider"
    except RuntimeError:
        execution_provider = "not_initialized"
    except Exception:
        execution_provider = "error"

    return {
        "face_detection_provider": settings.face_detection_provider,
        "execution_provider": execution_provider,
        "gpu_available": gpu_available,
        "model": settings.insightface_model,
    }


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

    await observer.shutdown()
    await shutdown_browser()
    await dispose_engine()
    log.info("scanner_service_stopped")


app = FastAPI(
    title="Made Of Us Scanner",
    version="0.1.0",
    lifespan=lifespan,
)

# Register admin router
from src.api.admin import router as admin_router
app.include_router(admin_router)


@app.get("/health")
async def health():
    """Health check endpoint with operational metrics."""
    uptime = time.monotonic() - _start_time

    try:
        async with async_session() as session:
            metrics = await get_scanner_metrics(session)
    except Exception as e:
        metrics = {"error": str(e)}

    try:
        async with async_session() as session:
            ml = await get_ml_metrics(session)
        ml["observer_buffer_size"] = observer.buffer_size

        # Add analyzer status
        try:
            global _health_recommender
            if _health_recommender is None:
                from src.intelligence.analyzers.threshold import ThresholdOptimizer
                from src.intelligence.analyzers.sections import SectionRanker
                from src.intelligence.recommender import Recommender
                _health_recommender = Recommender([ThresholdOptimizer(), SectionRanker()])
            analyzer_list = await _health_recommender.get_analyzer_status()
            ml["analyzers"] = {
                a["name"]: {
                    "status": a["status"],
                    "signals": a["signals"],
                    "minimum": a["minimum"],
                }
                for a in analyzer_list
            }
        except Exception:
            ml["analyzers"] = {}
    except Exception as e:
        ml = {"error": str(e)}

    try:
        async with async_session() as session:
            test_users = await get_test_user_stats(session)
    except Exception as e:
        test_users = {"error": str(e)}

    return {
        "status": "running",
        "uptime_seconds": round(uptime, 0),
        "metrics": metrics,
        "ml": ml,
        "test_users": test_users,
        "compute": _get_compute_info(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        log_level=settings.log_level.lower(),
    )
