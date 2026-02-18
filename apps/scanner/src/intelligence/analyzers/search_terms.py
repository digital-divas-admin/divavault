"""Search Term Scorer: evaluates search term effectiveness and discovers new terms.

Schedule: daily (every 24 hours)
Minimum signals: 100 crawl_completed signals
Model: TF-IDF for discriminative term extraction, yield-based scoring for removal
"""

from collections import defaultdict
from datetime import datetime, timezone

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sqlalchemy import func, select, text

from src.db.connection import async_session
from src.db.models import (
    DiscoveredImage,
    MLFeedbackSignal,
    Match,
    PlatformCrawlSchedule,
)
from src.intelligence.analyzers.base import BaseAnalyzer
from src.utils.logging import get_logger

log = get_logger("search_term_scorer")

# Minimum yield relative to platform average before recommending removal
YIELD_REMOVAL_FACTOR = 0.1

# Minimum TF-IDF score to recommend a new term
MIN_TFIDF_SCORE = 0.15

# Maximum new term recommendations per run
MAX_NEW_TERMS = 5

# Maximum removal recommendations per run
MAX_REMOVALS = 3


class SearchTermScorer(BaseAnalyzer):
    """Evaluates search term yield and discovers discriminative new terms."""

    def get_name(self) -> str:
        return "Search Term Scorer"

    def get_schedule_hours(self) -> float:
        return 24.0

    def get_minimum_signals(self) -> int:
        return 100

    async def analyze(self) -> list[dict]:
        # 1. Load crawl signals to understand term→platform mapping
        crawl_signals = await self._load_crawl_signals()
        if len(crawl_signals) < 10:
            log.info("search_term_scorer_skip", reason="insufficient_crawl_signals", count=len(crawl_signals))
            return []

        # 2. Load current search terms per platform
        platform_terms = await self._load_platform_terms()
        if not platform_terms:
            log.info("search_term_scorer_skip", reason="no_platform_terms")
            return []

        # 3. Compute yield per term per platform
        yield_data = await self._compute_term_yields(platform_terms)

        # 4. Generate removal recommendations for low-yield terms
        recommendations = []
        recommendations.extend(self._recommend_removals(yield_data, platform_terms))

        # 5. Extract discriminative terms from confirmed match page titles
        recommendations.extend(await self._recommend_additions(platform_terms))

        log.info(
            "search_term_scorer_complete",
            removals=sum(1 for r in recommendations if r["rec_type"] == "search_term_remove"),
            additions=sum(1 for r in recommendations if r["rec_type"] == "search_term_add"),
        )

        return recommendations

    async def _load_crawl_signals(self) -> list[dict]:
        """Load crawl_completed signals with search term context."""
        async with async_session() as session:
            result = await session.execute(
                select(MLFeedbackSignal)
                .where(MLFeedbackSignal.signal_type == "crawl_completed")
                .order_by(MLFeedbackSignal.created_at.desc())
                .limit(5000)
            )
            rows = result.scalars().all()

        return [
            {
                "platform": (row.context or {}).get("platform", "unknown"),
                "search_terms": (row.context or {}).get("search_terms", []),
                "images_discovered": (row.context or {}).get("images_discovered", 0),
                "created_at": row.created_at,
            }
            for row in rows
        ]

    async def _load_platform_terms(self) -> dict[str, list[str]]:
        """Load current search terms per platform from crawl schedule."""
        async with async_session() as session:
            result = await session.execute(
                select(PlatformCrawlSchedule)
                .where(PlatformCrawlSchedule.enabled == True)  # noqa: E712
            )
            rows = result.scalars().all()

        platform_terms = {}
        for row in rows:
            terms = row.search_terms
            if isinstance(terms, list):
                platform_terms[row.platform] = terms
            elif isinstance(terms, dict):
                # Handle {"terms": [...]} format
                platform_terms[row.platform] = terms.get("terms", [])
        return platform_terms

    async def _compute_term_yields(self, platform_terms: dict[str, list[str]]) -> dict[str, dict[str, dict]]:
        """Compute yield stats for each search term per platform.

        Returns: {platform: {term: {crawl_cycles, confirmed_matches, yield_score}}}
        """
        yield_data: dict[str, dict[str, dict]] = {}

        for platform, terms in platform_terms.items():
            yield_data[platform] = {}

            # Count confirmed matches per platform
            async with async_session() as session:
                result = await session.execute(
                    text("""
                        SELECT COUNT(*) as cnt
                        FROM matches m
                        JOIN discovered_images di ON m.discovered_image_id = di.id
                        WHERE di.platform = :platform
                          AND m.status IN ('reviewed', 'actionable', 'dmca_filed')
                    """),
                    {"platform": platform},
                )
                total_confirmed = result.scalar_one() or 0

            # Count crawl cycles for this platform
            async with async_session() as session:
                result = await session.execute(
                    select(func.count())
                    .select_from(MLFeedbackSignal)
                    .where(MLFeedbackSignal.signal_type == "crawl_completed")
                    .where(MLFeedbackSignal.context["platform"].astext == platform)
                )
                total_cycles = result.scalar_one() or 0

            platform_avg_yield = total_confirmed / max(total_cycles, 1)

            for term in terms:
                # Estimate crawl cycles involving this term
                async with async_session() as session:
                    result = await session.execute(
                        text("""
                            SELECT COUNT(*) FROM ml_feedback_signals
                            WHERE signal_type = 'crawl_completed'
                              AND context->>'platform' = :platform
                              AND context->'search_terms' ? :term
                        """),
                        {"platform": platform, "term": term},
                    )
                    term_cycles = result.scalar_one() or 0

                # Estimate confirmed matches from images discovered with this term
                # Use page_title/source_url containing the term as a heuristic
                async with async_session() as session:
                    result = await session.execute(
                        text("""
                            SELECT COUNT(DISTINCT m.id)
                            FROM matches m
                            JOIN discovered_images di ON m.discovered_image_id = di.id
                            WHERE di.platform = :platform
                              AND m.status IN ('reviewed', 'actionable', 'dmca_filed')
                              AND (di.page_title ILIKE :pattern OR di.source_url ILIKE :pattern)
                        """),
                        {"platform": platform, "pattern": f"%{term}%"},
                    )
                    term_confirmed = result.scalar_one() or 0

                term_yield = term_confirmed / max(term_cycles, 1)

                yield_data[platform][term] = {
                    "crawl_cycles": term_cycles,
                    "confirmed_matches": term_confirmed,
                    "yield_score": term_yield,
                    "platform_avg_yield": platform_avg_yield,
                    "below_threshold": term_yield < (platform_avg_yield * YIELD_REMOVAL_FACTOR) and term_cycles >= 5,
                }

        return yield_data

    def _recommend_removals(
        self,
        yield_data: dict[str, dict[str, dict]],
        platform_terms: dict[str, list[str]],
    ) -> list[dict]:
        """Recommend removal of low-yield search terms."""
        recommendations = []

        for platform, terms_data in yield_data.items():
            removal_candidates = [
                (term, data) for term, data in terms_data.items()
                if data["below_threshold"] and data["crawl_cycles"] >= 5
            ]

            # Sort by yield (lowest first) and cap
            removal_candidates.sort(key=lambda x: x[1]["yield_score"])
            for term, data in removal_candidates[:MAX_REMOVALS]:
                current_terms = platform_terms.get(platform, [])
                recommendations.append({
                    "rec_type": "search_term_remove",
                    "target_platform": platform,
                    "target_entity": term,
                    "current_value": {"search_terms": current_terms, "term": term},
                    "proposed_value": {"action": "remove", "term": term},
                    "reasoning": (
                        f"Search term '{term}' on {platform} has yield {data['yield_score']:.3f} "
                        f"({data['confirmed_matches']} confirmed matches over {data['crawl_cycles']} crawl cycles), "
                        f"which is below {YIELD_REMOVAL_FACTOR}x the platform average of {data['platform_avg_yield']:.3f}. "
                        f"Removing saves crawl resources."
                    ),
                    "expected_impact": f"Saves crawl resources for {data['crawl_cycles']} cycles/period with minimal match loss",
                    "confidence": min(0.85, 0.5 + data["crawl_cycles"] / 100),
                    "risk_level": "low",
                    "supporting_data": {
                        "term": term,
                        "platform": platform,
                        "yield_score": round(data["yield_score"], 4),
                        "platform_avg_yield": round(data["platform_avg_yield"], 4),
                        "crawl_cycles": data["crawl_cycles"],
                        "confirmed_matches": data["confirmed_matches"],
                    },
                })

        return recommendations

    async def _recommend_additions(self, platform_terms: dict[str, list[str]]) -> list[dict]:
        """Use TF-IDF on confirmed match page titles to find discriminative terms."""
        # Load page titles from confirmed matches
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT di.page_title, di.platform
                    FROM matches m
                    JOIN discovered_images di ON m.discovered_image_id = di.id
                    WHERE m.status IN ('reviewed', 'actionable', 'dmca_filed')
                      AND di.page_title IS NOT NULL
                      AND di.page_title != ''
                """)
            )
            confirmed_rows = result.fetchall()

        if len(confirmed_rows) < 10:
            return []

        # Load page titles from all discovered images (background corpus)
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT di.page_title, di.platform
                    FROM discovered_images di
                    WHERE di.page_title IS NOT NULL
                      AND di.page_title != ''
                    ORDER BY di.discovered_at DESC
                    LIMIT 10000
                """)
            )
            all_rows = result.fetchall()

        if len(all_rows) < 20:
            return []

        # Build per-platform corpora
        recommendations = []
        platforms = set(row[1] for row in confirmed_rows if row[1])

        for platform in platforms:
            confirmed_titles = [row[0] for row in confirmed_rows if row[1] == platform]
            all_titles = [row[0] for row in all_rows if row[1] == platform]

            if len(confirmed_titles) < 5 or len(all_titles) < 10:
                continue

            existing_terms = set(t.lower() for t in platform_terms.get(platform, []))

            new_terms = self._extract_discriminative_terms(
                confirmed_titles, all_titles, existing_terms
            )

            current_terms = platform_terms.get(platform, [])
            for term, score in new_terms[:MAX_NEW_TERMS]:
                recommendations.append({
                    "rec_type": "search_term_add",
                    "target_platform": platform,
                    "target_entity": term,
                    "current_value": {"search_terms": current_terms},
                    "proposed_value": {"action": "add", "term": term},
                    "reasoning": (
                        f"Term '{term}' appears frequently in confirmed match page titles on {platform} "
                        f"(TF-IDF score: {score:.3f}) but is not currently in the search term list. "
                        f"Adding it may discover more matches."
                    ),
                    "expected_impact": f"May discover new matches; discriminative score {score:.3f}",
                    "confidence": min(0.8, score),
                    "risk_level": "low",
                    "supporting_data": {
                        "term": term,
                        "platform": platform,
                        "tfidf_score": round(score, 4),
                        "confirmed_titles_with_term": sum(1 for t in confirmed_titles if term.lower() in t.lower()),
                        "total_confirmed_titles": len(confirmed_titles),
                    },
                })

        return recommendations

    def _extract_discriminative_terms(
        self,
        confirmed_titles: list[str],
        all_titles: list[str],
        existing_terms: set[str],
    ) -> list[tuple[str, float]]:
        """Extract terms that are discriminative for confirmed matches vs all content."""
        # Combine: confirmed = class 1, rest = class 0
        # Use TF-IDF on confirmed titles, then pick top terms not in existing set
        try:
            vectorizer = TfidfVectorizer(
                max_features=500,
                stop_words="english",
                ngram_range=(1, 2),
                min_df=2,
                max_df=0.8,
            )
            # Fit on all titles, transform confirmed titles
            vectorizer.fit(all_titles)
            confirmed_matrix = vectorizer.transform(confirmed_titles)

            # Average TF-IDF scores across confirmed titles
            mean_scores = np.asarray(confirmed_matrix.mean(axis=0)).flatten()
            feature_names = vectorizer.get_feature_names_out()

            # Rank by score
            scored_terms = sorted(
                zip(feature_names, mean_scores),
                key=lambda x: x[1],
                reverse=True,
            )

            # Filter: not already in existing terms, above minimum score
            new_terms = []
            for term, score in scored_terms:
                if score < MIN_TFIDF_SCORE:
                    break
                if term.lower() not in existing_terms and len(term) > 2:
                    new_terms.append((term, float(score)))
                if len(new_terms) >= MAX_NEW_TERMS:
                    break

            return new_terms

        except Exception as e:
            log.error("tfidf_extraction_error", error=str(e))
            return []
