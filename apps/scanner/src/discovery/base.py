"""Abstract discovery source interface and context."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from uuid import UUID

import numpy as np


class DetectionStrategy(Enum):
    """Whether face detection happens during crawl or in a separate phase.

    DEFERRED: Image URLs are stable (e.g. CivitAI CDN). Download + detect later
              in a subprocess. This is the default and the existing 3-phase pipeline.
    INLINE:   Image URLs expire (e.g. DeviantArt wixmp tokens). Must download and
              detect faces during the crawl while tokens are fresh.
    """

    DEFERRED = "deferred"
    INLINE = "inline"


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

    # Per-tag page depth overrides (e.g. damage-based priority crawl)
    tag_depths: dict[str, int] | None = None


@dataclass
class DiscoveredImageResult:
    """A candidate image found by a discovery source."""

    source_url: str
    page_url: str | None = None
    page_title: str | None = None
    platform: str | None = None
    image_stored_url: str | None = None


@dataclass
class InlineDetectedFace:
    """A face detected during inline detection, with its embedding."""

    face_index: int
    embedding: np.ndarray
    detection_score: float


@dataclass
class InlineDetectedImage:
    """An image that has already been through face detection (inline strategy)."""

    source_url: str
    page_url: str | None = None
    page_title: str | None = None
    has_face: bool = False
    face_count: int = 0
    faces: list[InlineDetectedFace] = field(default_factory=list)


@dataclass
class InlineDiscoveryResult:
    """Result from discover_with_detection() — images already have face data."""

    images: list[InlineDetectedImage]
    next_cursor: str | None = None

    # Per-term search cursors — resume each search term where it left off
    search_cursors: dict[str, str | None] | None = None

    # Tag coverage stats
    tags_total: int = 0
    tags_exhausted: int = 0

    # Inline detection stats
    images_downloaded: int = 0
    download_failures: int = 0
    faces_found: int = 0


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

    def get_detection_strategy(self) -> DetectionStrategy:
        """Declare whether this source needs inline face detection.

        Override to return INLINE if image URLs expire (e.g. DeviantArt wixmp tokens).
        Default is DEFERRED — the standard 3-phase pipeline.
        """
        return DetectionStrategy.DEFERRED

    @abstractmethod
    async def discover(self, context: DiscoveryContext) -> DiscoveryResult:
        """Find candidate images that might contain faces.

        For reverse image search: context includes contributor reference photos.
        For platform crawl: context includes platform and search terms.
        For URL check: context includes specific URLs to check.
        """
        ...

    async def discover_with_detection(
        self, context: DiscoveryContext, face_model
    ) -> InlineDiscoveryResult:
        """Crawl AND detect faces in one pass (for INLINE strategy).

        Only called when get_detection_strategy() == INLINE.
        The face_model is a loaded InsightFace model instance.

        Default implementation raises NotImplementedError — override in
        providers that need inline detection.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} declares INLINE strategy but "
            f"does not implement discover_with_detection()"
        )

    @abstractmethod
    def get_source_type(self) -> str:
        """Returns the source type identifier (e.g., 'reverse_image', 'platform_crawl')."""
        ...

    @abstractmethod
    def get_source_name(self) -> str:
        """Returns the source name (e.g., 'tineye', 'civitai')."""
        ...
