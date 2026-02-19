"""Admin API router for test user seeding, taxonomy mapper, and ML intelligence operations.

Auth: x-service-key header checked against settings.supabase_service_role_key.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select, text

from src.config import settings
from src.db.connection import async_session
from src.db.models import MLFeedbackSignal, MLRecommendation
from src.intelligence.observer import observer
from src.seeding.seed_manager import seed_manager

router = APIRouter(prefix="/admin", tags=["admin"])


# --- Auth dependency ---


async def verify_service_key(request: Request) -> None:
    """Verify the x-service-key header matches the service role key."""
    key = request.headers.get("x-service-key")
    if not key or key != settings.supabase_service_role_key:
        raise HTTPException(status_code=401, detail="Invalid service key")


# --- Request models ---


class SeedContributorRequest(BaseModel):
    full_name: str
    email: str
    photo_paths: list[dict]
    subscription_tier: str = "premium"


class SeedHoneypotRequest(BaseModel):
    contributor_id: str
    platform: str
    planted_url: str
    content_type: str
    difficulty: str
    generation_method: str | None = None
    expected_similarity_range: tuple[float, float] = (0.70, 0.95)


class AutoHoneypotRequest(BaseModel):
    count: int = 20
    platform: str | None = None


class SeedSyntheticRequest(BaseModel):
    base_contributor_ids: list[str]
    count: int = 500
    perturbation: float = 0.05


# --- Endpoints ---


@router.post("/seed/contributor", dependencies=[Depends(verify_service_key)])
async def create_seeded_contributor(body: SeedContributorRequest):
    """Create a seeded test contributor with photos queued for embedding."""
    result = await seed_manager.create_seeded_contributor(
        full_name=body.full_name,
        email=body.email,
        photo_paths=body.photo_paths,
        subscription_tier=body.subscription_tier,
    )
    return result


@router.post("/seed/honeypot", dependencies=[Depends(verify_service_key)])
async def create_honeypot_item(body: SeedHoneypotRequest):
    """Register a honeypot item planted on a platform."""
    result = await seed_manager.create_honeypot_item(
        contributor_id=body.contributor_id,
        platform=body.platform,
        planted_url=body.planted_url,
        content_type=body.content_type,
        difficulty=body.difficulty,
        generation_method=body.generation_method,
        expected_similarity_range=body.expected_similarity_range,
    )
    return result


@router.post("/seed/auto-honeypot", dependencies=[Depends(verify_service_key)])
async def create_auto_honeypots(body: AutoHoneypotRequest):
    """Pick random crawled face embeddings and create honeypot test contributors."""
    if body.count < 1 or body.count > 100:
        raise HTTPException(status_code=400, detail="Count must be 1-100")
    return await seed_manager.create_auto_honeypots(count=body.count, platform=body.platform)


@router.post("/seed/synthetic", dependencies=[Depends(verify_service_key)])
async def generate_synthetic_embeddings(body: SeedSyntheticRequest):
    """Generate synthetic contributors with perturbed embeddings."""
    result = await seed_manager.generate_synthetic_embeddings(
        base_contributor_ids=body.base_contributor_ids,
        count=body.count,
        perturbation=body.perturbation,
    )
    return result


@router.get("/seed/stats", dependencies=[Depends(verify_service_key)])
async def get_test_stats():
    """Get comprehensive test user statistics."""
    return await seed_manager.get_test_stats()


@router.get("/seed/honeypot-report", dependencies=[Depends(verify_service_key)])
async def get_honeypot_report():
    """Run honeypot detection check and return full report."""
    return await seed_manager.check_honeypot_detection()


@router.delete("/seed/synthetic", dependencies=[Depends(verify_service_key)])
async def cleanup_synthetic():
    """Delete all synthetic test contributors."""
    return await seed_manager.cleanup_synthetic()


# --- Taxonomy Mapper Endpoints ---


class ToggleSectionRequest(BaseModel):
    scan_enabled: bool


@router.get("/mapper/maps", dependencies=[Depends(verify_service_key)])
async def get_latest_map(platform: str = Query(...)):
    """Get the latest taxonomy map snapshot for a platform."""
    from sqlalchemy import select
    from src.db.connection import async_session
    from src.db.models import MLPlatformMap

    async with async_session() as session:
        result = await session.execute(
            select(MLPlatformMap)
            .where(MLPlatformMap.platform == platform)
            .order_by(MLPlatformMap.snapshot_at.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail=f"No map found for platform: {platform}")

    return {
        "id": str(row.id),
        "platform": row.platform,
        "taxonomy": row.taxonomy,
        "sections_discovered": row.sections_discovered,
        "snapshot_at": row.snapshot_at.isoformat() if row.snapshot_at else None,
    }


@router.get("/mapper/sections", dependencies=[Depends(verify_service_key)])
async def get_sections(platform: str = Query(...)):
    """Get all section profiles for a platform, sorted by ml_priority desc."""
    from sqlalchemy import select
    from src.db.connection import async_session
    from src.db.models import MLSectionProfile

    async with async_session() as session:
        result = await session.execute(
            select(MLSectionProfile)
            .where(MLSectionProfile.platform == platform)
            .order_by(MLSectionProfile.ml_priority.desc())
        )
        rows = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "section_key": r.section_key,
            "section_id": r.section_id,
            "section_name": r.section_name,
            "platform": r.platform,
            "total_content": r.total_content,
            "scan_enabled": r.scan_enabled,
            "human_override": r.human_override,
            "ai_recommendation": r.ai_recommendation,
            "ml_priority": r.ml_priority,
            "total_scanned": r.total_scanned,
            "total_faces": r.total_faces,
            "face_rate": r.face_rate,
            "last_crawl_at": r.last_crawl_at.isoformat() if r.last_crawl_at else None,
            "last_updated_at": r.last_updated_at.isoformat() if r.last_updated_at else None,
        }
        for r in rows
    ]


@router.patch("/mapper/sections/{section_id}/toggle", dependencies=[Depends(verify_service_key)])
async def toggle_section(section_id: str, body: ToggleSectionRequest):
    """Toggle scan_enabled for a section. Sets human_override=true."""
    from sqlalchemy import select
    from src.db.connection import async_session
    from src.db.models import MLSectionProfile
    from datetime import datetime, timezone

    async with async_session() as session:
        result = await session.execute(
            select(MLSectionProfile)
            .where(MLSectionProfile.id == section_id)
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(status_code=404, detail=f"Section not found: {section_id}")

        profile.scan_enabled = body.scan_enabled
        profile.human_override = True
        profile.last_updated_at = datetime.now(timezone.utc)
        await session.commit()

    return {
        "id": str(profile.id),
        "section_key": profile.section_key,
        "scan_enabled": profile.scan_enabled,
        "human_override": profile.human_override,
    }


@router.post("/mapper/run", dependencies=[Depends(verify_service_key)])
async def run_mapper_now(platform: str = Query(...)):
    """Trigger an immediate taxonomy mapping run for a platform."""
    from src.intelligence.mapper.orchestrator import run_mapper

    try:
        result = await run_mapper(platform)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mapper failed: {str(e)[:500]}")

    return {
        "platform": result.platform,
        "sections_discovered": result.sections_discovered,
        "snapshot_at": result.snapshot_at.isoformat(),
        "sections": [
            {
                "section_id": s.section_id,
                "section_name": s.section_name,
                "total_content": s.total_content,
            }
            for s in result.sections
        ],
    }


# --- ML Intelligence Endpoints ---

# Lazy-init ML singletons (shared with scheduler)
_ml_recommender = None


def _get_recommender():
    global _ml_recommender
    if _ml_recommender is None:
        from src.intelligence.analyzers.threshold import ThresholdOptimizer
        from src.intelligence.analyzers.sections import SectionRanker
        from src.intelligence.recommender import Recommender
        _ml_recommender = Recommender([ThresholdOptimizer(), SectionRanker()])
    return _ml_recommender


@router.get("/ml/recommendations", dependencies=[Depends(verify_service_key)])
async def get_recommendations(status: str | None = Query(None)):
    """List ML recommendations, optionally filtered by status."""
    async with async_session() as session:
        query = select(MLRecommendation).order_by(MLRecommendation.created_at.desc())
        if status:
            query = query.where(MLRecommendation.status == status)
        result = await session.execute(query)
        rows = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "recommendation_type": r.recommendation_type,
            "target_entity": r.target_entity,
            "target_platform": r.target_platform,
            "payload": r.payload,
            "confidence": r.confidence,
            "status": r.status,
            "reasoning": r.reasoning,
            "expected_impact": r.expected_impact,
            "risk_level": r.risk_level,
            "supporting_data": r.supporting_data,
            "reviewed_by": r.reviewed_by,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "applied_at": r.applied_at.isoformat() if r.applied_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/ml/recommendations/{rec_id}/approve", dependencies=[Depends(verify_service_key)])
async def approve_recommendation(rec_id: str = Path(...)):
    """Approve a pending recommendation for application."""
    async with async_session() as session:
        result = await session.execute(
            select(MLRecommendation).where(MLRecommendation.id == rec_id)
        )
        rec = result.scalar_one_or_none()
        if not rec:
            raise HTTPException(status_code=404, detail="Recommendation not found")
        if rec.status != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot approve recommendation with status '{rec.status}'")

        rec.status = "approved"
        rec.reviewed_at = datetime.now(timezone.utc)
        rec.reviewed_by = "admin"
        await session.commit()

        try:
            await observer.emit("recommendation_approved", "recommendation", str(rec.id), {
                "rec_type": rec.recommendation_type,
                "target_platform": rec.target_platform,
            })
        except Exception:
            pass

    return {
        "id": str(rec.id),
        "status": rec.status,
        "reviewed_at": rec.reviewed_at.isoformat(),
        "reviewed_by": rec.reviewed_by,
    }


@router.post("/ml/recommendations/{rec_id}/dismiss", dependencies=[Depends(verify_service_key)])
async def dismiss_recommendation(rec_id: str = Path(...)):
    """Dismiss a pending recommendation."""
    async with async_session() as session:
        result = await session.execute(
            select(MLRecommendation).where(MLRecommendation.id == rec_id)
        )
        rec = result.scalar_one_or_none()
        if not rec:
            raise HTTPException(status_code=404, detail="Recommendation not found")
        if rec.status != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot dismiss recommendation with status '{rec.status}'")

        rec.status = "dismissed"
        rec.reviewed_at = datetime.now(timezone.utc)
        rec.reviewed_by = "admin"
        await session.commit()

        try:
            await observer.emit("recommendation_dismissed", "recommendation", str(rec.id), {
                "rec_type": rec.recommendation_type,
                "target_platform": rec.target_platform,
            })
        except Exception:
            pass

    return {
        "id": str(rec.id),
        "status": rec.status,
        "reviewed_at": rec.reviewed_at.isoformat(),
        "reviewed_by": rec.reviewed_by,
    }


@router.get("/ml/analyzers", dependencies=[Depends(verify_service_key)])
async def get_analyzer_status():
    """Get status of all ML analyzers."""
    recommender = _get_recommender()
    status = await recommender.get_analyzer_status()
    return {"analyzers": status}


@router.get("/ml/signals/stats", dependencies=[Depends(verify_service_key)])
async def get_signal_stats():
    """Get ML feedback signal statistics."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    async with async_session() as session:
        # Total signals
        r = await session.execute(
            select(func.count()).select_from(MLFeedbackSignal)
        )
        total = r.scalar_one()

        # By type breakdown
        r = await session.execute(
            select(MLFeedbackSignal.signal_type, func.count())
            .group_by(MLFeedbackSignal.signal_type)
        )
        by_type = {row[0]: row[1] for row in r.all()}

        # Last 24h
        r = await session.execute(
            select(func.count()).select_from(MLFeedbackSignal)
            .where(MLFeedbackSignal.created_at > day_ago)
        )
        last_24h = r.scalar_one()

        # Last 7d
        r = await session.execute(
            select(func.count()).select_from(MLFeedbackSignal)
            .where(MLFeedbackSignal.created_at > week_ago)
        )
        last_7d = r.scalar_one()

    return {
        "total": total,
        "by_type": by_type,
        "last_24h": last_24h,
        "last_7d": last_7d,
    }
