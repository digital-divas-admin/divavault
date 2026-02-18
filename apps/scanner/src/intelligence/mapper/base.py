"""Base types and abstract class for platform taxonomy mappers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class Section:
    """A single content section discovered on a platform."""

    section_id: str
    section_name: str
    platform: str
    total_content: int = 0
    tags: list[str] = field(default_factory=list)
    content_types: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


@dataclass
class PlatformMap:
    """Snapshot of a platform's taxonomy at a point in time."""

    platform: str
    sections: list[Section]
    snapshot_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def sections_discovered(self) -> int:
        return len(self.sections)

    def to_taxonomy_json(self) -> dict:
        """Serialize to JSONB-compatible dict for ml_platform_maps.taxonomy."""
        return {
            "platform": self.platform,
            "snapshot_at": self.snapshot_at.isoformat(),
            "sections": [
                {
                    "section_id": s.section_id,
                    "section_name": s.section_name,
                    "total_content": s.total_content,
                    "tags": s.tags,
                    "content_types": s.content_types,
                    "metadata": s.metadata,
                }
                for s in self.sections
            ],
        }


@dataclass
class MapDiff:
    """Difference between two platform maps."""

    new_sections: list[Section]
    removed_section_ids: list[str]
    count_changes: dict[str, tuple[int, int]]  # section_id -> (old_count, new_count)


def compute_diff(old_map: PlatformMap | None, new_map: PlatformMap) -> MapDiff:
    """Compare two maps, flag new/removed sections and >20% count changes."""
    if old_map is None:
        return MapDiff(
            new_sections=list(new_map.sections),
            removed_section_ids=[],
            count_changes={},
        )

    old_by_id = {s.section_id: s for s in old_map.sections}
    new_by_id = {s.section_id: s for s in new_map.sections}

    new_sections = [s for s in new_map.sections if s.section_id not in old_by_id]
    removed_ids = [sid for sid in old_by_id if sid not in new_by_id]

    count_changes: dict[str, tuple[int, int]] = {}
    for sid, new_sec in new_by_id.items():
        if sid in old_by_id:
            old_count = old_by_id[sid].total_content
            new_count = new_sec.total_content
            if old_count > 0 and abs(new_count - old_count) / old_count > 0.20:
                count_changes[sid] = (old_count, new_count)

    return MapDiff(
        new_sections=new_sections,
        removed_section_ids=removed_ids,
        count_changes=count_changes,
    )


class BasePlatformMapper(ABC):
    """Abstract base for platform taxonomy mappers."""

    @abstractmethod
    async def build_map(self) -> PlatformMap:
        """Build a taxonomy map for the platform."""
        ...

    @abstractmethod
    def get_platform(self) -> str:
        """Return the platform identifier."""
        ...
