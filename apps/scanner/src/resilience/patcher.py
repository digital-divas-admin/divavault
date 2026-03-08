"""Patch generator: uses Claude CLI to generate unified diffs that fix crawler degradation."""

import json
import re

from src.config import settings
from src.db.connection import async_session
from src.resilience.cache import get_cached_healthy_pages
from src.resilience.constants import CRAWLER_FILES, SCANNER_ROOT, run_claude_cli
from src.resilience.models import CrawlerPatch, DegradationEvent
from src.utils.logging import get_logger

log = get_logger("resilience.patcher")


class PatchGenerator:
    """Generates crawler patches via Claude CLI."""

    async def generate(self, event: DegradationEvent, diagnosis: dict | None = None) -> CrawlerPatch | None:
        """Generate a patch for a degradation event. Returns CrawlerPatch or None."""
        if not settings.resilience_claude_enabled:
            log.info("patch_skip_claude_disabled", platform=event.platform)
            return None

        try:
            platform = event.platform
            crawler_file = CRAWLER_FILES.get(platform)
            if not crawler_file:
                log.warning("patch_no_crawler_file", platform=platform)
                return None

            crawler_path = SCANNER_ROOT / crawler_file
            if not crawler_path.exists():
                log.error("patch_crawler_not_found", path=str(crawler_path))
                return None

            crawler_source = crawler_path.read_text(encoding="utf-8")

            # Get cached healthy pages for comparison
            cached_pages = await get_cached_healthy_pages(platform)
            healthy_html = cached_pages[0].html_content[:5000] if cached_pages else ""

            # Build patch generation prompt
            prompt = self._build_patch_prompt(event, crawler_source, healthy_html, diagnosis)

            # Run Claude CLI (longer timeout for patch generation)
            result_text = await run_claude_cli(prompt, settings.resilience_claude_patch_timeout)
            if not result_text:
                return None

            # Parse response
            patch_data = self._parse_patch_response(result_text)
            if not patch_data or not patch_data.get("diff"):
                log.warning("patch_no_diff_generated", platform=platform)
                return None

            # Create patch record
            async with async_session() as session:
                patch = CrawlerPatch(
                    degradation_event_id=event.id,
                    platform=platform,
                    target_file=crawler_file,
                    patch_type=patch_data.get("patch_type", "selector_update"),
                    description=patch_data.get("description", ""),
                    diff_content=patch_data["diff"],
                    claude_reasoning=patch_data.get("reasoning", ""),
                    status="draft",
                )
                session.add(patch)
                await session.flush()
                patch_id = patch.id
                await session.commit()

            log.info(
                "patch_generated",
                platform=platform,
                patch_id=str(patch_id),
                patch_type=patch_data.get("patch_type"),
            )
            return patch

        except Exception as e:
            log.error("patch_generation_error", platform=event.platform, error=str(e))
            return None

    def _build_patch_prompt(
        self,
        event: DegradationEvent,
        crawler_source: str,
        healthy_html: str,
        diagnosis: dict | None,
    ) -> str:
        """Build the patch generation prompt for Claude."""
        diagnosis_section = ""
        if diagnosis:
            diagnosis_section = f"""
## Diagnosis
Root Cause: {diagnosis.get('root_cause', 'UNKNOWN')}
Explanation: {diagnosis.get('explanation', 'N/A')}
"""

        healthy_section = ""
        if healthy_html:
            healthy_section = f"""
## Healthy Page Snapshot (from when crawler was working)
```html
{healthy_html}
```
"""

        return f"""You are fixing a broken web crawler. Generate a unified diff patch to fix the issue.

## Degradation Event
Platform: {event.platform}
Type: {event.degradation_type}
Severity: {event.severity}
Symptom: {event.symptom}
{diagnosis_section}
{healthy_section}

## Current Crawler Source
```python
{crawler_source[:10000]}
```

## Constraints
- Output a unified diff applicable with `patch -p1`
- Preserve existing function signatures and method names
- Use fallback selector chains (primary -> data-attr -> xpath) for STRUCTURAL_CHANGE fixes
- Add realistic request timing jitter for ANTI_BOT fixes
- Handle both old and new formats for API_CHANGE fixes
- Keep changes minimal and focused

Respond in JSON format:
{{
  "patch_type": "selector_update|parser_rewrite|auth_flow|pagination_fix|new_module",
  "description": "Brief description of the fix",
  "diff": "--- a/src/discovery/...\\n+++ b/src/discovery/...\\n@@ ... @@\\n...",
  "reasoning": "Why this fix should work",
  "risk_level": "low|medium|high",
  "rollback_plan": "How to revert if this doesn't work"
}}"""

    def _parse_patch_response(self, text: str) -> dict | None:
        """Parse Claude's patch response JSON."""
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    pass
            log.warning("patch_response_parse_error")
            return None


patch_generator = PatchGenerator()
