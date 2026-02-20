"""Abstract scout source interface and data types."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ScoutCandidate:
    """A potential AI platform discovered by a scout source."""

    domain: str
    url: str
    name: str | None = None
    description: str | None = None
    source_query: str | None = None
    source_metadata: dict = field(default_factory=dict)


@dataclass
class ScoutSourceResult:
    """Result from a scout source's discover() call."""

    candidates: list[ScoutCandidate]
    queries_used: int = 0
    errors: list[str] = field(default_factory=list)


class BaseScoutSource(ABC):
    """Abstract interface for all scout sources."""

    @abstractmethod
    async def discover(self, keywords: list[dict]) -> ScoutSourceResult:
        """Find potential AI platforms.

        Args:
            keywords: List of keyword dicts with keys: category, keyword, weight, use_for.
                      Sources should use keywords where use_for in ('discover', 'both').
        """
        ...

    @abstractmethod
    def get_source_name(self) -> str:
        """Returns the source identifier (e.g., 'common_crawl', 'reddit')."""
        ...

    @abstractmethod
    def get_cost_tier(self) -> str:
        """Returns 'free' or 'paid'."""
        ...
