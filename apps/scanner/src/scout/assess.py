"""Platform risk assessment via HTTP GET + keyword scoring."""

import logging
import re
from collections import defaultdict

import aiohttp

from src.config import settings
from src.utils.rate_limiter import get_limiter

logger = logging.getLogger(__name__)


class PlatformAssessor:
    """Assess a candidate platform's risk score by visiting it and scoring keywords."""

    def __init__(self, keywords: list[dict]):
        """Initialize with keywords for assessment.

        Args:
            keywords: Keyword dicts with keys: category, keyword, weight, use_for.
                      Uses keywords where use_for in ('assess', 'both').
        """
        self.keywords = [
            kw for kw in keywords
            if kw.get("use_for") in ("assess", "both") and kw.get("enabled", True)
        ]

        # Group by category for capped scoring
        self.categories: dict[str, list[dict]] = defaultdict(list)
        for kw in self.keywords:
            self.categories[kw["category"]].append(kw)

    async def assess(self, url: str) -> dict:
        """Visit a URL and score it for AI platform risk.

        Returns:
            {
                "risk_score": float 0.0-1.0,
                "risk_factors": {"category": {"matched": [...], "score": float}},
                "title": str | None,
                "description": str | None,
            }
        """
        limiter = get_limiter("scout_assess")
        await limiter.acquire()

        title = None
        description = None
        html_text = ""

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=settings.scout_assessment_timeout),
                    allow_redirects=True,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; MadeOfUs-Scout/1.0)"},
                ) as resp:
                    if resp.status != 200:
                        return {
                            "risk_score": 0.0,
                            "risk_factors": {},
                            "title": None,
                            "description": None,
                            "error": f"HTTP {resp.status}",
                        }

                    html = await resp.text(encoding="utf-8", errors="replace")
                    html_text = html.lower()

                    # Extract title
                    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
                    if title_match:
                        title = title_match.group(1).strip()[:200]

                    # Extract meta description
                    desc_match = re.search(
                        r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']',
                        html, re.IGNORECASE
                    )
                    if desc_match:
                        description = desc_match.group(1).strip()[:500]

        except Exception as e:
            return {
                "risk_score": 0.0,
                "risk_factors": {},
                "title": None,
                "description": None,
                "error": str(e)[:200],
            }

        # Score by category — each category's contribution is capped at its weight
        risk_factors: dict[str, dict] = {}
        total_score = 0.0

        for category, kws in self.categories.items():
            matched = []
            category_weight = kws[0]["weight"] if kws else 0.0

            for kw in kws:
                if kw["keyword"].lower() in html_text:
                    matched.append(kw["keyword"])

            if matched:
                # Category score = category_weight * min(1.0, matched_count / total_in_category)
                ratio = min(1.0, len(matched) / max(1, len(kws)))
                category_score = category_weight * ratio
                total_score += category_score
                risk_factors[category] = {
                    "matched": matched,
                    "score": round(category_score, 3),
                }

        risk_score = min(1.0, round(total_score, 3))

        return {
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "title": title,
            "description": description,
        }
