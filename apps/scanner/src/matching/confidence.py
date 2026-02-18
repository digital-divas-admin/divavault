"""Confidence scoring, threshold application, and allowlist checking."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.queries import get_known_accounts
from src.utils.logging import get_logger
from src.utils.url_parser import check_allowlist

log = get_logger("confidence")


def get_confidence_tier(similarity: float) -> str | None:
    """Apply thresholds to determine confidence tier.

    Returns:
        'low', 'medium', 'high', or None if below minimum threshold.
    """
    from src.providers import get_match_scoring_provider

    return get_match_scoring_provider().score(similarity)


async def check_known_account(
    session: AsyncSession,
    contributor_id: UUID,
    page_url: str | None,
) -> dict | None:
    """Check if a page_url matches a contributor's known accounts.

    Returns the matching known account as a dict, or None.
    """
    if not page_url:
        return None

    accounts = await get_known_accounts(session, contributor_id)
    if not accounts:
        return None

    account_dicts = [
        {
            "id": acc.id,
            "platform": acc.platform,
            "handle": acc.handle,
            "domain": acc.domain,
        }
        for acc in accounts
    ]

    return check_allowlist(page_url, account_dicts)


def should_run_ai_detection(
    confidence_tier: str,
    is_known_account: bool,
    tier_config: dict,
) -> bool:
    """Determine if AI detection should run for this match."""
    if is_known_account:
        return False
    if not tier_config.get("ai_detection", False):
        return False
    # Only run for medium+ confidence
    if confidence_tier == "low":
        return False
    return True


def should_capture_evidence(
    confidence_tier: str,
    is_known_account: bool,
    tier_config: dict,
) -> bool:
    """Determine if evidence should be captured for this match."""
    if is_known_account:
        return False
    if not tier_config.get("capture_evidence", False):
        return False
    # Only capture for medium+ confidence
    if confidence_tier == "low":
        return False
    return True


def should_notify(
    confidence_tier: str,
    is_known_account: bool,
    tier_config: dict,
) -> bool:
    """Determine if the contributor should be notified about this match."""
    if is_known_account:
        return False
    if not tier_config.get("notify_on_match", False):
        return False
    # Notify for medium+ confidence
    if confidence_tier == "low":
        return False
    return True
