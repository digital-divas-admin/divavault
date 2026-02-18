"""ML-based match scoring provider.

Reads learned decision boundaries from ml_model_state (trained by the
Threshold Optimizer analyzer) and uses them instead of hardcoded thresholds.
Falls back to static thresholds if no model state is available.
"""

from src.config import settings
from src.providers.base import MatchScorerProvider
from src.utils.logging import get_logger

log = get_logger("ml_match_scorer")

# Cache refresh interval: re-read model state every N calls
_CACHE_REFRESH_INTERVAL = 100


class MLMatchScorer(MatchScorerProvider):
    """Maps cosine similarity to confidence tiers using ML-learned thresholds.

    Reads thresholds from the latest ml_model_state row for 'threshold_optimizer'.
    Falls back to config defaults if no trained model exists yet.
    """

    def __init__(self) -> None:
        self._thresholds: dict[str, float] | None = None
        self._call_count: int = 0

    def score(self, similarity: float) -> str | None:
        """Map similarity to a confidence tier using learned thresholds."""
        thresholds = self._get_thresholds()

        if similarity >= thresholds["high"]:
            return "high"
        elif similarity >= thresholds["medium"]:
            return "medium"
        elif similarity >= thresholds["low"]:
            return "low"
        return None

    def _get_thresholds(self) -> dict[str, float]:
        """Get current thresholds, refreshing from DB periodically."""
        self._call_count += 1

        if self._thresholds is None or self._call_count % _CACHE_REFRESH_INTERVAL == 0:
            self._thresholds = self._load_thresholds()

        return self._thresholds

    def _load_thresholds(self) -> dict[str, float]:
        """Load thresholds from ml_model_state synchronously.

        Uses a synchronous DB query since score() is called from sync context.
        Falls back to config defaults if no model state exists.
        """
        defaults = {
            "low": settings.match_threshold_low,
            "medium": settings.match_threshold_medium,
            "high": settings.match_threshold_high,
        }

        try:
            # Synchronous import + query since this provider is called from sync code
            from sqlalchemy import create_engine, text as sa_text
            engine = create_engine(
                settings.database_url.replace("+asyncpg", "").replace("postgresql+asyncpg", "postgresql"),
                pool_pre_ping=True,
                pool_size=1,
            )

            with engine.connect() as conn:
                result = conn.execute(
                    sa_text("""
                        SELECT parameters
                        FROM ml_model_state
                        WHERE model_name = 'threshold_optimizer'
                        ORDER BY version DESC
                        LIMIT 1
                    """)
                )
                row = result.fetchone()

            engine.dispose()

            if row and row[0]:
                params = row[0]
                thresholds = params.get("thresholds")
                if thresholds and all(k in thresholds for k in ("low", "medium", "high")):
                    log.info(
                        "ml_thresholds_loaded",
                        low=thresholds["low"],
                        medium=thresholds["medium"],
                        high=thresholds["high"],
                    )
                    return thresholds

        except Exception as e:
            log.warning("ml_threshold_load_failed", error=str(e))

        log.info("ml_scorer_using_defaults")
        return defaults
