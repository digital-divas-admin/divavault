"""Takedown filing logic (stub for future automated submission)."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Takedown
from src.enforcement.templates import generate_dmca_notice, generate_platform_report
from src.utils.logging import get_logger

log = get_logger("takedown")


async def create_takedown(
    session: AsyncSession,
    match_id: UUID,
    contributor_id: UUID,
    contributor_name: str,
    contributor_email: str,
    platform: str,
    infringing_url: str,
    match_confidence: str,
    is_ai_generated: bool | None = None,
    takedown_type: str = "dmca",
) -> Takedown:
    """Create a takedown record with a drafted notice.

    The notice is stored but NOT automatically submitted in MVP.
    Contributors can review and submit manually from the dashboard.
    """
    if takedown_type == "dmca":
        notice = generate_dmca_notice(
            contributor_name=contributor_name,
            contributor_email=contributor_email,
            infringing_url=infringing_url,
            platform=platform,
        )
    else:
        notice = generate_platform_report(
            contributor_name=contributor_name,
            infringing_url=infringing_url,
            platform=platform,
            match_confidence=match_confidence,
            is_ai_generated=is_ai_generated,
        )

    takedown = Takedown(
        match_id=match_id,
        contributor_id=contributor_id,
        platform=platform,
        takedown_type=takedown_type,
        notice_content=notice,
        status="pending",
    )
    session.add(takedown)
    await session.flush()

    log.info(
        "takedown_created",
        takedown_id=str(takedown.id),
        contributor_id=str(contributor_id),
        platform=platform,
        type=takedown_type,
    )

    return takedown
