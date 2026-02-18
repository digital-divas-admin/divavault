"""Abstract base classes for scanner provider interfaces."""

from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np

from src.matching.detector import DetectedFace


class AIClassification:
    """Result of AI-generated content classification."""

    __slots__ = ("is_ai_generated", "score", "generator")

    def __init__(
        self,
        is_ai_generated: bool | None,
        score: float,
        generator: str | None,
    ):
        self.is_ai_generated = is_ai_generated
        self.score = score
        self.generator = generator

    def to_dict(self) -> dict:
        return {
            "is_ai_generated": self.is_ai_generated,
            "score": self.score,
            "generator": self.generator,
        }


class FaceDetectionProvider(ABC):
    """Detects faces and generates embeddings in a single pass."""

    @abstractmethod
    def init_model(self, model_name: str | None = None) -> None:
        """Load the ML model. Called once at startup."""
        ...

    @abstractmethod
    def get_model(self) -> object:
        """Return the loaded model instance."""
        ...

    @abstractmethod
    def detect(self, image_path: Path) -> list[DetectedFace]:
        """Detect faces in an image. Returns faces with pre-computed embeddings."""
        ...


class AIDetectionProvider(ABC):
    """Classifies whether an image is AI-generated."""

    @abstractmethod
    async def classify(self, image_url: str) -> AIClassification | None:
        """Classify an image. Returns classification or None on failure."""
        ...


class MatchScorerProvider(ABC):
    """Scores match confidence from raw cosine similarity."""

    @abstractmethod
    def score(self, similarity: float) -> str | None:
        """Map similarity to a confidence tier ('low'/'medium'/'high') or None."""
        ...
