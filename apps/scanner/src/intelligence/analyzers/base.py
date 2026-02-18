"""Base analyzer interface for ML intelligence layer."""

from abc import ABC, abstractmethod


class BaseAnalyzer(ABC):
    """Abstract base for all analyzers.

    Analyzers read pipeline data, learn patterns, and produce recommendations.
    They NEVER auto-apply changes — all recommendations require human approval.
    """

    @abstractmethod
    async def analyze(self) -> list[dict]:
        """Run analysis, return list of recommendation dicts.

        Each dict has keys:
            rec_type: str           — e.g. 'threshold_change', 'section_toggle'
            target_platform: str | None
            target_entity: str | None
            current_value: dict
            proposed_value: dict
            reasoning: str          — human-readable explanation
            expected_impact: str
            confidence: float       — 0-1
            risk_level: str         — 'low', 'medium', 'high'
            supporting_data: dict
        """
        ...

    @abstractmethod
    def get_schedule_hours(self) -> float:
        """How often to run, in hours."""
        ...

    @abstractmethod
    def get_minimum_signals(self) -> int:
        """Minimum total signals in ml_feedback_signals before this analyzer runs."""
        ...

    @abstractmethod
    def get_name(self) -> str:
        """Human-readable name shown in dashboard and logs."""
        ...
