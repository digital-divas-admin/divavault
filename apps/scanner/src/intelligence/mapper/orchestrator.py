"""Mapper orchestrator — runs mappers, stores results, provides crawl filtering."""

import json
from datetime import datetime, timezone

from sqlalchemy import select, text

from src.db.connection import async_session
from src.db.models import MLPlatformMap, MLSectionProfile
from src.intelligence.mapper.base import (
    BasePlatformMapper,
    MapDiff,
    PlatformMap,
    Section,
    compute_diff,
)
from src.intelligence.mapper.civitai import CivitAIMapper, SECTION_TO_SEARCH_TERMS as CIVITAI_TERMS
from src.intelligence.mapper.deviantart import DeviantArtMapper, SECTION_TO_SEARCH_TERMS as DA_TERMS
from src.intelligence.observer import observer
from src.utils.logging import get_logger

log = get_logger("mapper_orchestrator")

MAPPERS: dict[str, BasePlatformMapper] = {
    "civitai": CivitAIMapper(),
    "deviantart": DeviantArtMapper(),
}

# Combined search term lookup per platform
_SEARCH_TERM_MAPS: dict[str, dict[str, list[str]]] = {
    "civitai": CIVITAI_TERMS,
    "deviantart": DA_TERMS,
}


async def run_mapper(platform: str) -> PlatformMap:
    """Main entry point: build map, diff, store, return."""
    mapper = MAPPERS.get(platform)
    if not mapper:
        raise ValueError(f"Unknown mapper platform: {platform}")

    # Build new map
    new_map = await mapper.build_map()

    # Load previous map for diffing
    old_map = await _load_latest_map(platform)

    # Compute diff
    diff = compute_diff(old_map, new_map)
    _log_diff(platform, diff)

    # Store new map snapshot
    await _store_map_snapshot(platform, new_map)

    # Upsert section profiles
    await _upsert_section_profiles(new_map, diff)

    # Emit observer signals
    try:
        await observer.emit("taxonomy_mapped", "platform", platform, {
            "sections_discovered": new_map.sections_discovered,
            "new_sections": len(diff.new_sections),
            "removed_sections": len(diff.removed_section_ids),
            "count_changes": len(diff.count_changes),
        })
    except Exception:
        pass

    log.info(
        "mapper_complete",
        platform=platform,
        sections=new_map.sections_discovered,
        new=len(diff.new_sections),
        removed=len(diff.removed_section_ids),
    )
    return new_map


async def get_enabled_search_terms(platform: str) -> list[str] | None:
    """Get merged search terms from enabled sections for crawl filtering.

    Returns:
        None — no section profiles exist (backward compat, crawl everything)
        [] — profiles exist but none enabled (skip crawl)
        list[str] — merged search terms from enabled sections
    """
    async with async_session() as session:
        result = await session.execute(
            select(MLSectionProfile.section_key, MLSectionProfile.scan_enabled)
            .where(MLSectionProfile.platform == platform)
        )
        rows = result.all()

    if not rows:
        return None  # No profiles yet — backward compat

    term_map = _SEARCH_TERM_MAPS.get(platform, {})
    merged: list[str] = []
    for row in rows:
        if row.scan_enabled:
            terms = term_map.get(row.section_key, [])
            merged.extend(terms)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for t in merged:
        if t not in seen:
            seen.add(t)
            unique.append(t)

    return unique


async def update_section_stats(
    platform: str,
    total_scanned: int,
    total_faces: int,
) -> None:
    """Update aggregate stats on all enabled sections for a platform after a crawl."""
    async with async_session() as session:
        result = await session.execute(
            select(MLSectionProfile)
            .where(MLSectionProfile.platform == platform)
            .where(MLSectionProfile.scan_enabled == True)  # noqa: E712
        )
        profiles = result.scalars().all()

        if not profiles:
            return

        # Distribute stats evenly across enabled sections (approximation)
        per_section_scanned = total_scanned // len(profiles) if profiles else 0
        per_section_faces = total_faces // len(profiles) if profiles else 0

        for profile in profiles:
            profile.total_scanned = (profile.total_scanned or 0) + per_section_scanned
            profile.total_faces = (profile.total_faces or 0) + per_section_faces
            total = profile.total_scanned
            profile.face_rate = profile.total_faces / total if total > 0 else 0.0
            profile.last_crawl_at = datetime.now(timezone.utc)

        await session.commit()


async def get_latest_map_time(platform: str) -> datetime | None:
    """Get the timestamp of the most recent map snapshot for a platform."""
    async with async_session() as session:
        result = await session.execute(
            select(MLPlatformMap.snapshot_at)
            .where(MLPlatformMap.platform == platform)
            .order_by(MLPlatformMap.snapshot_at.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
    return row


# --- Internal helpers ---


async def _load_latest_map(platform: str) -> PlatformMap | None:
    """Load the most recent platform map from ml_platform_maps."""
    async with async_session() as session:
        result = await session.execute(
            select(MLPlatformMap)
            .where(MLPlatformMap.platform == platform)
            .order_by(MLPlatformMap.snapshot_at.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()

    if row is None:
        return None

    taxonomy = row.taxonomy or {}
    sections = []
    for s in taxonomy.get("sections", []):
        sections.append(
            Section(
                section_id=s["section_id"],
                section_name=s["section_name"],
                platform=platform,
                total_content=s.get("total_content", 0),
                tags=s.get("tags", []),
                content_types=s.get("content_types", []),
            )
        )

    return PlatformMap(
        platform=platform,
        sections=sections,
        snapshot_at=row.snapshot_at,
    )


async def _store_map_snapshot(platform: str, platform_map: PlatformMap) -> None:
    """INSERT a new map snapshot into ml_platform_maps."""
    async with async_session() as session:
        new_row = MLPlatformMap(
            platform=platform,
            taxonomy=platform_map.to_taxonomy_json(),
            sections_discovered=platform_map.sections_discovered,
            snapshot_at=platform_map.snapshot_at,
        )
        session.add(new_row)
        await session.commit()


async def _upsert_section_profiles(
    platform_map: PlatformMap,
    diff: MapDiff,
) -> None:
    """Upsert section profiles into ml_section_profiles.

    New sections: scan_enabled=false, ai_recommendation='unknown', ml_priority=0.5
    Existing sections: only update total_content, section_name, last_updated_at
    """
    removed_ids = set(diff.removed_section_ids)

    async with async_session() as session:
        for section in platform_map.sections:
            # Check if exists
            result = await session.execute(
                select(MLSectionProfile)
                .where(MLSectionProfile.section_key == section.section_id)
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Update content count and name only — never overwrite scan_enabled/human_override
                existing.total_content = section.total_content
                existing.section_name = section.section_name
                existing.last_updated_at = datetime.now(timezone.utc)
            else:
                # New section
                new_profile = MLSectionProfile(
                    section_key=section.section_id,
                    platform=section.platform,
                    section_id=section.section_id,
                    section_name=section.section_name,
                    total_content=section.total_content,
                    scan_enabled=False,
                    human_override=False,
                    ai_recommendation="unknown",
                    ml_priority=0.5,
                )
                session.add(new_profile)

        # Disable removed sections
        if removed_ids:
            for section_id in removed_ids:
                result = await session.execute(
                    select(MLSectionProfile)
                    .where(MLSectionProfile.section_key == section_id)
                )
                profile = result.scalar_one_or_none()
                if profile:
                    profile.scan_enabled = False
                    profile.last_updated_at = datetime.now(timezone.utc)

        await session.commit()


def _log_diff(platform: str, diff: MapDiff) -> None:
    """Log diff details."""
    if diff.new_sections:
        log.info(
            "mapper_new_sections",
            platform=platform,
            sections=[s.section_id for s in diff.new_sections],
        )
    if diff.removed_section_ids:
        log.info(
            "mapper_removed_sections",
            platform=platform,
            sections=diff.removed_section_ids,
        )
    if diff.count_changes:
        for sid, (old, new) in diff.count_changes.items():
            log.info("mapper_count_change", section=sid, old=old, new=new)
