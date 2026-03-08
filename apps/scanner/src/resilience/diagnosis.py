"""Diagnosis engine: captures page snapshots and uses Claude CLI to diagnose crawler degradation."""

import json
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from src.config import settings
from src.db.connection import async_session
from src.resilience.constants import (
    CRAWLER_FILES,
    MONITORED_PLATFORMS,
    PLATFORM_DIAGNOSTIC_URLS,
    SCANNER_ROOT,
    run_claude_cli,
)
from src.resilience.models import DegradationEvent
from src.utils.logging import get_logger

log = get_logger("resilience.diagnosis")


class DiagnosisEngine:
    """Diagnoses crawler degradation using page snapshots and Claude CLI."""

    async def diagnose(self, event_id: UUID) -> str | None:
        """Diagnose a degradation event. Returns diagnosis text or None on failure."""
        try:
            async with async_session() as session:
                event = await session.get(DegradationEvent, event_id)
                if not event:
                    log.error("diagnosis_event_not_found", event_id=str(event_id))
                    return None

                platform = event.platform

                # Capture page snapshot
                snapshot_data = await self._capture_snapshot(platform)

                # If Claude diagnosis is disabled, just record the snapshot
                if not settings.resilience_claude_enabled:
                    if snapshot_data:
                        event.page_snapshot_url = snapshot_data.get("storage_path")
                    event.status = "diagnosed"
                    event.diagnosis = "Claude diagnosis disabled — snapshot captured only"
                    event.diagnosis_at = datetime.now(timezone.utc)
                    await session.commit()
                    log.info("diagnosis_skip_claude_disabled", platform=platform)
                    return None

                # Load crawler source code
                crawler_file = CRAWLER_FILES.get(platform)
                crawler_source = ""
                if crawler_file:
                    crawler_path = SCANNER_ROOT / crawler_file
                    if crawler_path.exists():
                        crawler_source = crawler_path.read_text(encoding="utf-8")

                # Build diagnostic prompt
                prompt = self._build_diagnosis_prompt(event, snapshot_data, crawler_source)

                # Run Claude CLI
                diagnosis_text = await run_claude_cli(prompt, settings.resilience_claude_diagnosis_timeout)
                if not diagnosis_text:
                    log.warning("diagnosis_claude_no_output", platform=platform)
                    return None

                # Parse root cause
                root_cause = self._extract_root_cause(diagnosis_text)

                # Update event in same session
                event.diagnosis = diagnosis_text
                event.diagnosis_at = datetime.now(timezone.utc)
                event.root_cause = root_cause
                event.status = "diagnosed"
                if snapshot_data:
                    event.page_snapshot_url = snapshot_data.get("storage_path")
                await session.commit()

                log.info(
                    "diagnosis_complete",
                    platform=platform,
                    root_cause=root_cause,
                    event_id=str(event_id),
                )
                return diagnosis_text

        except Exception as e:
            log.error("diagnosis_error", event_id=str(event_id), error=str(e))
            return None

    async def _capture_snapshot(self, platform: str) -> dict | None:
        """Capture a page snapshot using the evidence capture module."""
        url = PLATFORM_DIAGNOSTIC_URLS.get(platform)
        if not url:
            return None

        try:
            from src.evidence.capture import capture_page_snapshot
            result = await capture_page_snapshot(url)
            if not result:
                return None

            return {
                "html": result["html"],
                "title": result["page_title"],
                "url": url,
                "storage_path": f"resilience-snapshots/{platform}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.html",
            }
        except Exception as e:
            log.error("snapshot_capture_error", platform=platform, error=str(e))
            return None

    def _build_diagnosis_prompt(
        self,
        event: DegradationEvent,
        snapshot: dict | None,
        crawler_source: str,
    ) -> str:
        """Build the diagnostic prompt for Claude."""
        snapshot_section = ""
        if snapshot:
            html_preview = snapshot.get("html", "")[:5000]
            snapshot_section = f"""
## Current Page Snapshot
URL: {snapshot.get('url', 'N/A')}
Title: {snapshot.get('title', 'N/A')}

HTML (first 5000 chars):
```html
{html_preview}
```
"""

        crawler_section = ""
        if crawler_source:
            source_preview = crawler_source[:8000]
            crawler_section = f"""
## Crawler Source Code (first 8000 chars)
```python
{source_preview}
```
"""

        return f"""You are diagnosing a web crawler that has degraded. Analyze the symptoms and determine the root cause.

## Degradation Event
Platform: {event.platform}
Type: {event.degradation_type}
Severity: {event.severity}
Symptom: {event.symptom}
Baseline Value: {event.baseline_value}
Current Value: {event.current_value}
Deviation: {event.deviation_pct}%
{snapshot_section}
{crawler_section}

## Task
1. Analyze the symptom, page snapshot, and crawler source
2. Determine the most likely root cause
3. Classify the root cause as ONE of: STRUCTURAL_CHANGE, API_CHANGE, ANTI_BOT, RATE_LIMIT, CONTENT_GONE, UNKNOWN

Respond in JSON format:
{{
  "root_cause": "STRUCTURAL_CHANGE|API_CHANGE|ANTI_BOT|RATE_LIMIT|CONTENT_GONE|UNKNOWN",
  "explanation": "Brief explanation of what changed and why the crawler is failing",
  "confidence": 0.0-1.0,
  "evidence": ["list of specific observations supporting your diagnosis"]
}}"""

    def _extract_root_cause(self, diagnosis_text: str) -> str:
        """Extract root_cause classification from Claude's response."""
        valid_causes = {"STRUCTURAL_CHANGE", "API_CHANGE", "ANTI_BOT", "RATE_LIMIT", "CONTENT_GONE", "UNKNOWN"}
        try:
            data = json.loads(diagnosis_text)
            cause = data.get("root_cause", "UNKNOWN").upper()
            return cause if cause in valid_causes else "UNKNOWN"
        except (json.JSONDecodeError, AttributeError):
            for cause in valid_causes:
                if cause in diagnosis_text.upper():
                    return cause
            return "UNKNOWN"


diagnosis_engine = DiagnosisEngine()
