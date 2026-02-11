"""Abstract discovery source interface and context."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from uuid import UUID


@dataclass
class DiscoveryContext:
    """What a discovery source needs to do its job."""

    # Set for reverse_image and url_check, None for platform_crawl
    contributor_id: UUID | None = None
    contributor_tier: str = "free"

    # Reference image storage paths: list of (bucket, file_path) tuples
    images: list[tuple[str, str]] = field(default_factory=list)

    # Set for platform_crawl
    platform: str | None = None
    search_terms: list[str] | None = None

    # Set for url_check
    urls: list[str] | None = None

    # Pagination cursor from previous crawl (stored in platform_crawl_schedule.search_terms)
    cursor: str | None = None

    # Per-term search cursors for resumable image searches
    search_cursors: dict[str, str] | None = None

    # Per-tag model cursors for resumable LoRA model crawl
    model_cursors: dict[str, str] | None = None


@dataclass
class DiscoveredImageResult:
    """A candidate image found by a discovery source."""

    source_url: str
    page_url: str | None = None
    page_title: str | None = None
    platform: str | None = None


@dataclass
class DiscoveryResult:
    """Wrapper for discovery results with optional pagination cursor."""

    images: list[DiscoveredImageResult]
    next_cursor: str | None = None

    # Per-term search cursors — resume each search term where it left off
    search_cursors: dict[str, str | None] | None = None

    # Per-tag model cursors — resume each LoRA tag where it left off
    model_cursors: dict[str, str | None] | None = None

    # Tag coverage stats — how many tags were crawled and how many are exhausted
    tags_total: int = 0
    tags_exhausted: int = 0


class BaseDiscoverySource(ABC):
    """Abstract interface for all discovery sources."""

    @abstractmethod
    async def discover(self, context: DiscoveryContext) -> DiscoveryResult:
        """Find candidate images that might contain faces.

        For reverse image search: context includes contributor reference photos.
        For platform crawl: context includes platform and search terms.
        For URL check: context includes specific URLs to check.
        """
        ...

    @abstractmethod
    def get_source_type(self) -> str:
        """Returns the source type identifier (e.g., 'reverse_image', 'platform_crawl')."""
        ...

    @abstractmethod
    def get_source_name(self) -> str:
        """Returns the source name (e.g., 'tineye', 'civitai')."""
        ...
