"""Static threshold-based match scoring provider."""

from src.config import settings
from src.providers.base import MatchScorerProvider


class StaticMatchScorer(MatchScorerProvider):
    """Maps cosine similarity to confidence tiers using fixed thresholds from config."""

    def score(self, similarity: float) -> str | None:
        if similarity >= settings.match_threshold_high:
            return "high"
        elif similarity >= settings.match_threshold_medium:
            return "medium"
        elif similarity >= settings.match_threshold_low:
            return "low"
        return None
