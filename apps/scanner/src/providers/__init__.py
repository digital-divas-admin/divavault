"""Provider registry — factory functions for pluggable scanner components.

Each factory returns a singleton instance based on the config setting.
Supports standalone initialization (no FastAPI dependency) so subprocesses
like scripts/process_faces.py can use the same providers.
"""

from src.config import settings
from src.providers.base import (
    AIDetectionProvider,
    FaceDetectionProvider,
    MatchScorerProvider,
)

_face_detection: FaceDetectionProvider | None = None
_ai_detection: AIDetectionProvider | None = None
_match_scorer: MatchScorerProvider | None = None


def get_face_detection_provider() -> FaceDetectionProvider:
    """Get or create the face detection provider singleton."""
    global _face_detection
    if _face_detection is None:
        provider_name = settings.face_detection_provider
        if provider_name == "insightface":
            from src.providers.face_detection.insightface import (
                InsightFaceFaceDetection,
            )

            _face_detection = InsightFaceFaceDetection()
        else:
            raise ValueError(f"Unknown face detection provider: {provider_name}")
    return _face_detection


def get_ai_detection_provider() -> AIDetectionProvider:
    """Get or create the AI detection provider singleton."""
    global _ai_detection
    if _ai_detection is None:
        provider_name = settings.ai_detection_provider
        if provider_name == "hive":
            from src.providers.ai_detection.hive import HiveAIDetection

            _ai_detection = HiveAIDetection()
        else:
            raise ValueError(f"Unknown AI detection provider: {provider_name}")
    return _ai_detection


def get_match_scoring_provider() -> MatchScorerProvider:
    """Get or create the match scoring provider singleton."""
    global _match_scorer
    if _match_scorer is None:
        provider_name = settings.match_scoring_provider
        if provider_name == "static":
            from src.providers.match_scoring.static import StaticMatchScorer

            _match_scorer = StaticMatchScorer()
        elif provider_name == "ml":
            from src.providers.match_scoring.ml_scorer import MLMatchScorer

            _match_scorer = MLMatchScorer()
        else:
            raise ValueError(f"Unknown match scoring provider: {provider_name}")
    return _match_scorer
