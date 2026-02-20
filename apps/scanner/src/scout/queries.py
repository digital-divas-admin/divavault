"""Database queries for scout tables."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from src.db.connection import async_session
from src.db.models import ScoutDiscovery, ScoutRun, ScoutKeyword


# --- Discoveries ---

async def upsert_discovery(
    domain: str,
    url: str,
    source: str,
    name: str | None = None,
    description: str | None = None,
    source_query: str | None = None,
    source_metadata: dict | None = None,
) -> tuple[UUID, bool]:
    """Insert a discovery or return existing. Returns (id, is_new)."""
    async with async_session() as session:
        # Try insert, on conflict do nothing
        stmt = pg_insert(ScoutDiscovery).values(
            domain=domain,
            url=url,
            source=source,
            name=name,
            description=description,
            source_query=source_query,
            source_metadata=source_metadata or {},
        ).on_conflict_do_nothing(index_elements=["domain"]).returning(ScoutDiscovery.id)

        result = await session.execute(stmt)
        row = result.scalar_one_or_none()
        await session.commit()

        if row:
            return row, True

        # Already existed — fetch existing
        result = await session.execute(
            select(ScoutDiscovery.id).where(ScoutDiscovery.domain == domain)
        )
        return result.scalar_one(), False


async def update_discovery_assessment(
    discovery_id: UUID,
    risk_score: float,
    risk_factors: dict,
    name: str | None = None,
    description: str | None = None,
) -> None:
    """Update a discovery with assessment results."""
    async with async_session() as session:
        result = await session.execute(
            select(ScoutDiscovery).where(ScoutDiscovery.id == discovery_id)
        )
        disc = result.scalar_one()
        disc.risk_score = risk_score
        disc.risk_factors = risk_factors
        disc.assessed_at = datetime.now(timezone.utc)
        if name:
            disc.name = name
        if description:
            disc.description = description
        disc.assessment_error = None
        await session.commit()


async def update_discovery_assessment_error(
    discovery_id: UUID, error: str
) -> None:
    """Record an assessment error."""
    async with async_session() as session:
        result = await session.execute(
            select(ScoutDiscovery).where(ScoutDiscovery.id == discovery_id)
        )
        disc = result.scalar_one()
        disc.assessed_at = datetime.now(timezone.utc)
        disc.assessment_error = error
        await session.commit()


async def list_discoveries(
    status: str | None = None, limit: int = 100
) -> list[dict]:
    """List discoveries, optionally filtered by status."""
    async with async_session() as session:
        query = select(ScoutDiscovery).order_by(ScoutDiscovery.risk_score.desc())
        if status:
            query = query.where(ScoutDiscovery.status == status)
        query = query.limit(limit)
        result = await session.execute(query)
        rows = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "domain": r.domain,
            "url": r.url,
            "name": r.name,
            "description": r.description,
            "source": r.source,
            "source_query": r.source_query,
            "risk_score": r.risk_score,
            "risk_factors": r.risk_factors,
            "assessed_at": r.assessed_at.isoformat() if r.assessed_at else None,
            "assessment_error": r.assessment_error,
            "status": r.status,
            "reviewed_by": r.reviewed_by,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "dismiss_reason": r.dismiss_reason,
            "promoted_platform": r.promoted_platform,
            "promoted_at": r.promoted_at.isoformat() if r.promoted_at else None,
            "discovered_at": r.discovered_at.isoformat() if r.discovered_at else None,
        }
        for r in rows
    ]


async def approve_discovery(discovery_id: str) -> dict:
    """Approve a pending discovery."""
    async with async_session() as session:
        result = await session.execute(
            select(ScoutDiscovery).where(ScoutDiscovery.id == discovery_id)
        )
        disc = result.scalar_one_or_none()
        if not disc:
            raise ValueError("Discovery not found")
        disc.status = "approved"
        disc.reviewed_by = "admin"
        disc.reviewed_at = datetime.now(timezone.utc)
        await session.commit()
    return {"id": str(disc.id), "status": disc.status}


async def dismiss_discovery(discovery_id: str, reason: str | None = None) -> dict:
    """Dismiss a discovery with optional reason."""
    async with async_session() as session:
        result = await session.execute(
            select(ScoutDiscovery).where(ScoutDiscovery.id == discovery_id)
        )
        disc = result.scalar_one_or_none()
        if not disc:
            raise ValueError("Discovery not found")
        disc.status = "dismissed"
        disc.reviewed_by = "admin"
        disc.reviewed_at = datetime.now(timezone.utc)
        disc.dismiss_reason = reason
        await session.commit()
    return {"id": str(disc.id), "status": disc.status}


# --- Runs ---

async def create_run(source: str) -> UUID:
    """Create a new scout run record."""
    async with async_session() as session:
        run = ScoutRun(source=source)
        session.add(run)
        await session.commit()
        await session.refresh(run)
        return run.id


async def complete_run(
    run_id: UUID,
    domains_found: int,
    domains_new: int,
    error_message: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Mark a run as completed."""
    async with async_session() as session:
        result = await session.execute(
            select(ScoutRun).where(ScoutRun.id == run_id)
        )
        run = result.scalar_one()
        run.completed_at = datetime.now(timezone.utc)
        run.status = "completed" if not error_message else "failed"
        run.domains_found = domains_found
        run.domains_new = domains_new
        run.error_message = error_message
        if metadata:
            run.extra_metadata = metadata
        await session.commit()


async def list_runs(limit: int = 20) -> list[dict]:
    """List recent scout runs."""
    async with async_session() as session:
        result = await session.execute(
            select(ScoutRun).order_by(ScoutRun.started_at.desc()).limit(limit)
        )
        rows = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "source": r.source,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "status": r.status,
            "domains_found": r.domains_found,
            "domains_new": r.domains_new,
            "error_message": r.error_message,
        }
        for r in rows
    ]


# --- Keywords ---

async def list_keywords(enabled_only: bool = False) -> list[dict]:
    """List all scout keywords."""
    async with async_session() as session:
        query = select(ScoutKeyword).order_by(ScoutKeyword.category, ScoutKeyword.keyword)
        if enabled_only:
            query = query.where(ScoutKeyword.enabled == True)
        result = await session.execute(query)
        rows = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "category": r.category,
            "keyword": r.keyword,
            "weight": r.weight,
            "use_for": r.use_for,
            "enabled": r.enabled,
        }
        for r in rows
    ]


async def add_keyword(
    category: str, keyword: str, weight: float = 0.1, use_for: str = "assess"
) -> dict:
    """Add a new scout keyword."""
    async with async_session() as session:
        kw = ScoutKeyword(
            category=category,
            keyword=keyword,
            weight=weight,
            use_for=use_for,
        )
        session.add(kw)
        await session.commit()
        await session.refresh(kw)
    return {
        "id": str(kw.id),
        "category": kw.category,
        "keyword": kw.keyword,
        "weight": kw.weight,
        "use_for": kw.use_for,
        "enabled": kw.enabled,
    }


async def update_keyword(
    keyword_id: str,
    weight: float | None = None,
    enabled: bool | None = None,
    use_for: str | None = None,
) -> dict:
    """Update a scout keyword's weight, enabled state, or use_for."""
    async with async_session() as session:
        result = await session.execute(
            select(ScoutKeyword).where(ScoutKeyword.id == keyword_id)
        )
        kw = result.scalar_one_or_none()
        if not kw:
            raise ValueError("Keyword not found")
        if weight is not None:
            kw.weight = weight
        if enabled is not None:
            kw.enabled = enabled
        if use_for is not None:
            kw.use_for = use_for
        await session.commit()
    return {
        "id": str(kw.id),
        "category": kw.category,
        "keyword": kw.keyword,
        "weight": kw.weight,
        "use_for": kw.use_for,
        "enabled": kw.enabled,
    }


async def delete_keyword(keyword_id: str) -> None:
    """Delete a scout keyword."""
    async with async_session() as session:
        result = await session.execute(
            select(ScoutKeyword).where(ScoutKeyword.id == keyword_id)
        )
        kw = result.scalar_one_or_none()
        if not kw:
            raise ValueError("Keyword not found")
        await session.delete(kw)
        await session.commit()


async def get_known_platforms() -> set[str]:
    """Get domains of already-known platforms (from platform_crawl_schedule)."""
    from src.db.models import PlatformCrawlSchedule

    async with async_session() as session:
        result = await session.execute(
            select(PlatformCrawlSchedule.platform)
        )
        platforms = result.scalars().all()

    # platform_crawl_schedule stores names like "civitai", "deviantart"
    # Map to known domains
    known_domain_map = {
        "civitai": "civitai.com",
        "deviantart": "deviantart.com",
    }
    known = set()
    for p in platforms:
        if p in known_domain_map:
            known.add(known_domain_map[p])
        else:
            known.add(f"{p}.com")

    # Also add already-discovered domains that are approved
    result2_data = await list_discoveries(status="approved")
    for d in result2_data:
        known.add(d["domain"])

    return known
