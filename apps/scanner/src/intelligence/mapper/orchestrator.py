"""Mapper orchestrator — runs mappers, stores results, provides crawl filtering."""

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select, text

from src.config import settings
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
    """Main entry point: build map, discover new sections, diff, store, return."""
    mapper = MAPPERS.get(platform)
    if not mapper:
        raise ValueError(f"Unknown mapper platform: {platform}")

    # 1. Probe known sections (existing behavior)
    new_map = await mapper.build_map()

    # 2. Discover unknown sections (adaptive discovery)
    try:
        # Inject cross-platform risk terms if available
        cross_terms = await get_cross_platform_risk_terms()
        if cross_terms:
            mapper._cross_platform_risk_terms = cross_terms

        discovered = await mapper.discover_sections()
        if discovered:
            new_map.sections.extend(discovered)
            log.info(
                "mapper_discovered_new",
                platform=platform,
                count=len(discovered),
                sections=[s.section_id for s in discovered],
            )
    except Exception as e:
        log.error("mapper_discover_error", platform=platform, error=str(e))

    # 3. Load previous map for diffing
    old_map = await _load_latest_map(platform)

    # 4. Compute diff
    diff = compute_diff(old_map, new_map)
    _log_diff(platform, diff)

    # 5. Store new map snapshot
    await _store_map_snapshot(platform, new_map)

    # 6. Upsert section profiles
    await _upsert_section_profiles(new_map, diff)

    # 7. Emit observer signals
    try:
        await observer.emit("taxonomy_mapped", "platform", platform, {
            "sections_discovered": new_map.sections_discovered,
            "new_sections": len(diff.new_sections),
            "removed_sections": len(diff.removed_section_ids),
            "count_changes": len(diff.count_changes),
            "dynamically_discovered": len(discovered) if 'discovered' in dir() else 0,
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


async def get_cross_platform_risk_terms() -> list[str]:
    """Return terms that are confirmed high-risk on ANY platform.

    A term is high-risk if its sections have face_rate > 0.5 and
    risk level is high or medium with significant scan volume.
    These are used as seed queries for discover_sections() on other platforms.
    """
    try:
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT DISTINCT unnest(tags) as tag
                    FROM ml_section_profiles
                    WHERE face_rate > 0.5
                    AND ml_risk_level IN ('high', 'medium')
                    AND total_scanned > 100
                """)
            )
            return [row[0] for row in result.fetchall()]
    except Exception as e:
        log.error("cross_platform_risk_error", error=str(e))
        return []


@dataclass
class UnifiedSearchConfig:
    """Unified crawl configuration for any platform.

    Encapsulates mapper-enabled search terms and damage-tier priority
    in a single object consumed by the scheduler.
    """

    effective_terms: list[str] | None  # None = no profiles yet (backward compat)
    tag_depths: dict[str, int] | None  # per-tag page depth overrides
    damage_breakdown: dict[str, int] | None  # {"high": N, "medium": N, "low": N}
    mapper_active: bool  # whether mapper profiles were found


async def get_search_config(platform: str) -> UnifiedSearchConfig:
    """Return a unified crawl configuration for any platform.

    Tries prioritized (damage-tier) config first, falls back to flat
    term list. This replaces the platform-specific branching in the scheduler.
    """
    prioritized = await get_prioritized_search_config(platform)

    if prioritized is not None:
        if len(prioritized) == 0:
            return UnifiedSearchConfig(
                effective_terms=[],
                tag_depths=None,
                damage_breakdown=None,
                mapper_active=True,
            )

        from collections import Counter

        damage_counts = Counter(c.damage_level for c in prioritized)
        return UnifiedSearchConfig(
            effective_terms=[c.tag for c in prioritized],
            tag_depths={c.tag: c.max_pages for c in prioritized},
            damage_breakdown={
                "high": damage_counts.get("high", 0),
                "medium": damage_counts.get("medium", 0),
                "low": damage_counts.get("low", 0),
            },
            mapper_active=True,
        )

    # No prioritized config — try flat term list
    flat_terms = await get_enabled_search_terms(platform)
    if flat_terms is not None and len(flat_terms) == 0:
        return UnifiedSearchConfig(
            effective_terms=[],
            tag_depths=None,
            damage_breakdown=None,
            mapper_active=True,
        )

    return UnifiedSearchConfig(
        effective_terms=flat_terms,
        tag_depths=None,
        damage_breakdown=None,
        mapper_active=flat_terms is not None,
    )


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


@dataclass
class TagSearchConfig:
    """Per-tag crawl configuration with damage-based priority."""

    tag: str
    max_pages: int
    priority: float
    damage_level: str  # "high", "medium", "low"


# --- Damage-level keyword sets for tag classification ---

_HIGH_DAMAGE_KEYWORDS: set[str] = {
    # Explicit / sexual content
    "nude", "naked", "nudeart", "nudefemale", "nakedfemale", "femalenude", "malenude", "nudephotography",
    "sexy", "sexygirl", "sexybody", "sexylegs", "sexyback", "sexywoman", "sexymusclegirl", "sexyblondegirl",
    "erotic", "eroticphotography",
    "breast", "nipples", "pussy",
    "nsfw", "ainsfw", "ainude", "aihentai",
    "lingerie", "bikini", "boudoir", "boudoirphotography", "intimatephotography",
    "curves", "curvywoman", "curvygirl", "voluptuous", "hourglass",
    "hotwoman", "hotgirl", "hotmodel", "hotcosplay", "sexycosplay",
    # Deepfake / non-consensual intimate imagery
    "deepfake", "faceswap", "faceswapai", "celebfakes", "celebrityfakes", "fakecelebrity",
    # Fetish / bondage
    "bondage", "fetish", "latexfetish", "leatherfetish", "bootsfetish", "footfetish", "latex",
    # Body-focused
    "figure", "perfectbody", "thickbody", "thickgirl", "bigbooty",
    "pinup",
}

_MEDIUM_DAMAGE_KEYWORDS: set[str] = {
    # Beauty / appearance
    "beauty", "beautifulwoman", "beautifulgirl", "stunningbeauty", "sexybeautiful", "beautifulface", "prettyface",
    # Gender / person words
    "woman", "girl", "female", "male", "man", "boy", "brunette", "blonde",
    # Modeling / glamour
    "model", "modelphotography", "facemodel", "glamour", "glamourphotography",
    # Realistic AI
    "realistic", "airealistic", "hyperrealistic", "photorealism", "photorealistic",
    # Portraits / faces
    "portrait", "portraitart", "portraitphotography", "headshot", "selfie", "face", "faceclaim",
    # Celebrity
    "celebrity", "hollywoodstar", "moviestar", "actress", "actor", "singer",
    "kpop", "koreanbeauty", "koreangirl", "idol", "japanesebeauty", "japanesegirl",
    "supermodel", "influencer",
    # AI person-focused
    "aiportrait", "aiphoto", "aiwoman", "aigirl", "aiman", "aibeauty", "aimodel", "aiface", "aicelebrity", "aicharacter",
    # Cute / pretty
    "cute", "cutegirl", "cutewoman", "prettygirl", "gorgeouswoman",
    # Cosplay
    "cosplay", "cosplayer", "cosplaygirl", "animecosplay",
    # Alt / goth
    "goth", "gothic", "gothgirl", "gothmodel", "altgirl", "altmodel", "punkgirl", "emogirl",
    # Fitness
    "fitgirl", "fitwoman", "musclewoman", "musclegirl", "athleticgirl",
    # Ethnicity-specific person tags
    "asian", "asianwoman", "asiangirl", "asianbeauty",
    "latina", "latinamodel", "african", "blackwoman", "blackbeauty",
    "indian", "indianwoman", "indianbeauty", "russianmodel", "russiangirl",
    # Fashion photography
    "editorialphotography", "fashionphotography", "lookbook",
}

_DAMAGE_TIER_WEIGHT = {"high": 3.0, "medium": 2.0, "low": 1.0}


def _classify_tag_damage(tag: str) -> str:
    """Classify a single tag into a damage level."""
    tag_lower = tag.lower()
    if tag_lower in _HIGH_DAMAGE_KEYWORDS:
        return "high"
    if tag_lower in _MEDIUM_DAMAGE_KEYWORDS:
        return "medium"
    return "low"


def _depth_for_damage(damage_level: str) -> int:
    """Map damage level to page depth from config."""
    if damage_level == "high":
        return settings.deviantart_high_damage_pages
    if damage_level == "medium":
        return settings.deviantart_medium_damage_pages
    return settings.deviantart_low_damage_pages


async def get_prioritized_search_config(platform: str) -> list[TagSearchConfig] | None:
    """Get damage-prioritized tag configs for a platform crawl.

    Returns:
        None — no section profiles exist (backward compat)
        [] — profiles exist but none enabled
        list[TagSearchConfig] — tags sorted by priority descending (most damaging first)
    """
    async with async_session() as session:
        result = await session.execute(
            select(
                MLSectionProfile.section_key,
                MLSectionProfile.scan_enabled,
                MLSectionProfile.tags,
                MLSectionProfile.face_rate,
                MLSectionProfile.ml_priority,
                MLSectionProfile.ml_risk_level,
            ).where(MLSectionProfile.platform == platform)
        )
        rows = result.all()

    if not rows:
        return None

    term_map = _SEARCH_TERM_MAPS.get(platform, {})

    # Collect tags with face_rate context from their parent section
    tag_face_rates: dict[str, float] = {}  # tag → max face_rate across sections
    tag_ml_priorities: dict[str, float] = {}  # tag → max ml_priority across sections
    enabled_tags: set[str] = set()

    for row in rows:
        if not row.scan_enabled:
            continue
        section_tags = term_map.get(row.section_key, [])
        face_rate = row.face_rate or 0.0
        ml_priority = row.ml_priority or 0.5
        for tag in section_tags:
            enabled_tags.add(tag)
            tag_face_rates[tag] = max(tag_face_rates.get(tag, 0.0), face_rate)
            tag_ml_priorities[tag] = max(tag_ml_priorities.get(tag, 0.5), ml_priority)

    # Build TagSearchConfig for each unique enabled tag
    configs: list[TagSearchConfig] = []
    for tag in enabled_tags:
        base_damage = _classify_tag_damage(tag)
        face_rate = tag_face_rates.get(tag, 0.0)

        # Face rate boost: if section face_rate > 0.30, bump up one tier
        effective_damage = base_damage
        if face_rate > 0.30:
            if base_damage == "low":
                effective_damage = "medium"
            elif base_damage == "medium":
                effective_damage = "high"

        max_pages = _depth_for_damage(effective_damage)

        # Compute sort priority
        tier_weight = _DAMAGE_TIER_WEIGHT[effective_damage]
        face_boost = face_rate  # 0.0–1.0
        ml_boost = tag_ml_priorities.get(tag, 0.5) * 0.1
        priority = tier_weight + face_boost + ml_boost

        configs.append(TagSearchConfig(
            tag=tag,
            max_pages=max_pages,
            priority=priority,
            damage_level=effective_damage,
        ))

    # Sort by priority descending (most damaging first)
    configs.sort(key=lambda c: c.priority, reverse=True)
    return configs


async def update_section_stats(
    platform: str,
    **_kwargs,
) -> None:
    """Recompute per-section stats from actual discovered_images data.

    Uses search_term column to map images to sections via their tags.
    Untagged (legacy) images are distributed proportionally by tag count.
    Accepts and ignores total_scanned/total_faces kwargs for backward compat.
    """
    async with async_session() as session:
        # 1. Get all enabled sections with their tags
        result = await session.execute(
            select(MLSectionProfile)
            .where(MLSectionProfile.platform == platform)
            .where(MLSectionProfile.scan_enabled == True)  # noqa: E712
        )
        profiles = result.scalars().all()

        if not profiles:
            return

        # 2. Query per-tag stats from discovered_images
        tag_stats_rows = (await session.execute(text("""
            SELECT search_term,
                   COUNT(*) AS scanned,
                   COUNT(*) FILTER (WHERE has_face = true) AS faces
            FROM discovered_images
            WHERE platform = :platform
              AND search_term IS NOT NULL
            GROUP BY search_term
        """), {"platform": platform})).fetchall()

        tag_stats = {row[0]: (row[1], row[2]) for row in tag_stats_rows}

        # 3. Also get platform-level stats for untagged images (legacy data)
        untagged = (await session.execute(text("""
            SELECT COUNT(*) AS scanned,
                   COUNT(*) FILTER (WHERE has_face = true) AS faces
            FROM discovered_images
            WHERE platform = :platform AND search_term IS NULL
        """), {"platform": platform})).fetchone()
        untagged_scanned = untagged[0] if untagged else 0
        untagged_faces = untagged[1] if untagged else 0

        # 4. Map tags → sections, compute per-section totals
        all_section_tags = sum(len(p.tags or []) for p in profiles)
        for profile in profiles:
            section_scanned = 0
            section_faces = 0
            for tag in (profile.tags or []):
                stats = tag_stats.get(tag)
                if stats:
                    section_scanned += stats[0]
                    section_faces += stats[1]

            # Distribute untagged images proportionally by tag count
            if all_section_tags > 0 and untagged_scanned > 0:
                weight = len(profile.tags or []) / all_section_tags
                section_scanned += int(untagged_scanned * weight)
                section_faces += int(untagged_faces * weight)

            profile.total_scanned = section_scanned
            profile.total_faces = section_faces
            profile.face_rate = (
                section_faces / section_scanned if section_scanned > 0 else 0.0
            )
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
                # Update content count, name, and tags — never overwrite scan_enabled/human_override
                existing.total_content = section.total_content
                existing.section_name = section.section_name
                existing.tags = section.tags
                existing.last_updated_at = datetime.now(timezone.utc)
            else:
                # New section
                new_profile = MLSectionProfile(
                    section_key=section.section_id,
                    platform=section.platform,
                    section_id=section.section_id,
                    section_name=section.section_name,
                    total_content=section.total_content,
                    tags=section.tags,
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
