"""Source Intelligence: builds account risk profiles and detects hostile clusters.

Schedule: daily (every 24 hours)
Minimum signals: 10 confirmed matches (need enough source accounts to analyze)
Model: heuristic graph analysis (Counter + defaultdict), upgradeable to GNN later
"""

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy import select, text

from src.db.connection import async_session
from src.db.models import ContributorKnownAccount, Match
from src.intelligence.analyzers.base import BaseAnalyzer
from src.utils.logging import get_logger

log = get_logger("source_intelligence")

# Minimum confirmed matches for an account to be flagged as hostile
MIN_MATCHES_HOSTILE = 3

# URL patterns to extract account handles
ACCOUNT_PATTERNS = {
    "civitai": r"civitai\.com/user/([^/?#]+)",
    "deviantart": r"deviantart\.com/([^/?#]+)",
    "reddit": r"reddit\.com/(?:user|u)/([^/?#]+)",
}


class SourceIntelligence(BaseAnalyzer):
    """Builds account risk profiles and detects hostile upload clusters."""

    def get_name(self) -> str:
        return "Source Intelligence"

    def get_schedule_hours(self) -> float:
        return 24.0

    def get_minimum_signals(self) -> int:
        return 10

    async def analyze(self) -> list[dict]:
        # 1. Load confirmed matches with source account info
        match_data = await self._load_confirmed_matches()
        if len(match_data) < 5:
            log.info("source_intelligence_skip", reason="insufficient_matches", count=len(match_data))
            return []

        # 2. Build account profiles
        account_profiles = self._build_account_profiles(match_data)

        # 3. Load known accounts (allowlist)
        known_accounts = await self._load_known_accounts()

        # 4. Identify hostile accounts
        hostile = self._identify_hostile_accounts(account_profiles, known_accounts)

        # 5. Detect clusters (accounts sharing patterns)
        clusters = self._detect_clusters(account_profiles)

        # 6. Score new accounts for risk (before they hit hostile threshold)
        new_account_recs = self._score_new_accounts(account_profiles, hostile, clusters, known_accounts)

        # 7. Generate recommendations
        recommendations = []
        recommendations.extend(self._recommend_hostile_flags(hostile))
        recommendations.extend(self._recommend_priority_sources(clusters, hostile))
        recommendations.extend(new_account_recs)

        # 8. Persist hostile accounts to DB
        if hostile:
            await self._persist_hostile_accounts(hostile)

        log.info(
            "source_intelligence_complete",
            accounts_analyzed=len(account_profiles),
            hostile_accounts=len(hostile),
            clusters_found=len(clusters),
            recommendations=len(recommendations),
        )

        return recommendations

    async def _load_confirmed_matches(self) -> list[dict]:
        """Load matches with confirmed/actionable status and source account info."""
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT
                        m.id, m.source_account, m.is_known_account,
                        m.contributor_id, m.similarity_score,
                        m.is_ai_generated, m.ai_generator,
                        di.platform, di.page_url, di.page_title,
                        di.source_url
                    FROM matches m
                    JOIN discovered_images di ON m.discovered_image_id = di.id
                    WHERE m.status IN ('reviewed', 'actionable', 'dmca_filed')
                    ORDER BY m.created_at DESC
                    LIMIT 10000
                """)
            )
            rows = result.fetchall()

        data = []
        for row in rows:
            source_account = row[1]
            page_url = row[8]

            # Try to extract account handle from URL if source_account is empty
            if not source_account and page_url:
                source_account = self._extract_account_from_url(page_url, row[7])

            if not source_account:
                continue

            data.append({
                "match_id": str(row[0]),
                "source_account": source_account,
                "is_known_account": row[2],
                "contributor_id": str(row[3]),
                "similarity_score": float(row[4]) if row[4] else 0.0,
                "is_ai_generated": row[5],
                "ai_generator": row[6],
                "platform": row[7],
                "page_url": page_url,
                "page_title": row[9],
                "source_url": row[10],
            })

        return data

    def _extract_account_from_url(self, url: str, platform: str | None) -> str | None:
        """Extract account handle from page URL using platform-specific patterns."""
        if not url:
            return None

        for plat, pattern in ACCOUNT_PATTERNS.items():
            if platform and platform.lower() != plat:
                continue
            match = re.search(pattern, url, re.IGNORECASE)
            if match:
                return match.group(1)

        return None

    def _build_account_profiles(self, match_data: list[dict]) -> dict[str, dict]:
        """Group match data by account and build profiles."""
        profiles: dict[str, dict] = {}

        for d in match_data:
            key = f"{d['platform']}:{d['source_account']}"

            if key not in profiles:
                profiles[key] = {
                    "account": d["source_account"],
                    "platform": d["platform"],
                    "match_count": 0,
                    "contributors_affected": set(),
                    "ai_generators": Counter(),
                    "page_titles": [],
                    "is_known": d["is_known_account"],
                    "matches": [],
                }

            p = profiles[key]
            p["match_count"] += 1
            p["contributors_affected"].add(d["contributor_id"])
            if d["ai_generator"]:
                p["ai_generators"][d["ai_generator"]] += 1
            if d["page_title"]:
                p["page_titles"].append(d["page_title"])
            p["matches"].append(d)

        return profiles

    async def _load_known_accounts(self) -> set[str]:
        """Load contributor known accounts (allowlist) to exclude from hostile detection."""
        async with async_session() as session:
            result = await session.execute(
                select(ContributorKnownAccount)
            )
            rows = result.scalars().all()

        known = set()
        for row in rows:
            if row.handle and row.platform:
                known.add(f"{row.platform}:{row.handle}")
        return known

    def _identify_hostile_accounts(
        self,
        profiles: dict[str, dict],
        known_accounts: set[str],
    ) -> list[dict]:
        """Identify accounts with 3+ confirmed matches as hostile."""
        hostile = []

        for key, profile in profiles.items():
            # Skip known/verified accounts
            if key in known_accounts or profile["is_known"]:
                continue

            if profile["match_count"] >= MIN_MATCHES_HOSTILE:
                hostile.append({
                    "account": profile["account"],
                    "platform": profile["platform"],
                    "match_count": profile["match_count"],
                    "contributors_affected": len(profile["contributors_affected"]),
                    "top_generator": profile["ai_generators"].most_common(1)[0][0] if profile["ai_generators"] else None,
                    "evidence": {
                        "match_count": profile["match_count"],
                        "unique_contributors": len(profile["contributors_affected"]),
                        "ai_generators": dict(profile["ai_generators"]),
                        "sample_titles": profile["page_titles"][:5],
                    },
                })

        return hostile

    def _detect_clusters(self, profiles: dict[str, dict]) -> list[dict]:
        """Detect clusters of accounts sharing patterns (generator, titles, cross-posted content)."""
        clusters = []

        # Group by platform
        by_platform: dict[str, list[dict]] = defaultdict(list)
        for key, profile in profiles.items():
            by_platform[profile["platform"]].append(profile)

        for platform, platform_profiles in by_platform.items():
            # --- Shared generator clustering (existing) ---
            generator_groups: dict[str, list[dict]] = defaultdict(list)
            for p in platform_profiles:
                if p["ai_generators"]:
                    top_gen = p["ai_generators"].most_common(1)[0][0]
                    generator_groups[top_gen].append(p)

            for generator, group in generator_groups.items():
                if len(group) >= 2:
                    clusters.append({
                        "platform": platform,
                        "cluster_type": "shared_generator",
                        "generator": generator,
                        "accounts": [p["account"] for p in group],
                        "total_matches": sum(p["match_count"] for p in group),
                    })

            # --- Title-pattern clustering (new) ---
            clusters.extend(self._cluster_by_titles(platform, platform_profiles))

        # --- Cross-account image dedup (new, cross-platform) ---
        clusters.extend(self._detect_cross_account_content(profiles))

        return clusters

    def _cluster_by_titles(self, platform: str, profiles: list[dict]) -> list[dict]:
        """Group accounts by similar page title patterns using Jaccard similarity."""
        from src.intelligence.analyzers.sections import jaccard_similarity

        # Build per-account title word sets
        account_titles: list[tuple[dict, set[str]]] = []
        for p in profiles:
            if p["page_titles"]:
                words: set[str] = set()
                for title in p["page_titles"]:
                    words.update(title.lower().split())
                if words:
                    account_titles.append((p, words))

        if len(account_titles) < 2:
            return []

        # Find groups with >0.5 title overlap across 3+ title matches
        clusters = []
        visited: set[str] = set()

        for i, (p1, words1) in enumerate(account_titles):
            if p1["account"] in visited:
                continue
            group = [p1]
            for j, (p2, words2) in enumerate(account_titles):
                if j <= i or p2["account"] in visited:
                    continue
                # Jaccard on word sets
                intersection = words1 & words2
                union = words1 | words2
                sim = len(intersection) / len(union) if union else 0.0
                if sim > 0.5:
                    group.append(p2)

            if len(group) >= 2:
                for p in group:
                    visited.add(p["account"])
                clusters.append({
                    "platform": platform,
                    "cluster_type": "shared_titles",
                    "generator": None,
                    "accounts": [p["account"] for p in group],
                    "total_matches": sum(p["match_count"] for p in group),
                })

        return clusters

    def _detect_cross_account_content(self, profiles: dict[str, dict]) -> list[dict]:
        """Find source_urls posted by multiple accounts (cross-posted/stolen content)."""
        # Collect source_url → set of accounts
        url_accounts: dict[str, set[str]] = defaultdict(set)
        url_platforms: dict[str, str] = {}

        for key, profile in profiles.items():
            for match in profile["matches"]:
                src_url = match.get("source_url")
                if src_url:
                    url_accounts[src_url].add(profile["account"])
                    url_platforms[src_url] = profile["platform"]

        # Find URLs shared by 2+ accounts
        shared_groups: dict[str, set[str]] = defaultdict(set)
        shared_platform: dict[str, str] = {}
        for url, accounts in url_accounts.items():
            if len(accounts) >= 2:
                group_key = "|".join(sorted(accounts))
                shared_groups[group_key] |= accounts
                shared_platform[group_key] = url_platforms[url]

        clusters = []
        for group_key, accounts in shared_groups.items():
            platform = shared_platform[group_key]
            clusters.append({
                "platform": platform,
                "cluster_type": "shared_content",
                "generator": None,
                "accounts": list(accounts),
                "total_matches": sum(
                    profiles.get(f"{platform}:{a}", {}).get("match_count", 0)
                    for a in accounts
                ),
            })

        return clusters

    def _score_new_accounts(
        self,
        profiles: dict[str, dict],
        hostile: list[dict],
        clusters: list[dict],
        known_accounts: set[str],
    ) -> list[dict]:
        """Score accounts with <3 matches for risk based on similarity to hostile accounts."""
        hostile_accounts = {f"{h['platform']}:{h['account']}" for h in hostile}
        hostile_generators = {h["top_generator"] for h in hostile if h.get("top_generator")}
        hostile_platforms = {h["platform"] for h in hostile}

        # Build set of hostile title words for comparison
        hostile_title_words: set[str] = set()
        for key in hostile_accounts:
            p = profiles.get(key)
            if p:
                for title in p.get("page_titles", []):
                    hostile_title_words.update(title.lower().split())

        # Build map of account → cluster memberships
        account_clusters: dict[str, list[dict]] = defaultdict(list)
        for cluster in clusters:
            for account in cluster["accounts"]:
                account_clusters[f"{cluster['platform']}:{account}"].append(cluster)

        recommendations = []
        for key, profile in profiles.items():
            # Only score accounts with <3 matches (not yet hostile)
            if key in hostile_accounts or key in known_accounts or profile["is_known"]:
                continue
            if profile["match_count"] >= MIN_MATCHES_HOSTILE:
                continue

            risk = 0.0

            # 0.3 weight: shares AI generator with any hostile account
            if profile["ai_generators"]:
                top_gen = profile["ai_generators"].most_common(1)[0][0]
                if top_gen in hostile_generators:
                    risk += 0.3

            # 0.3 weight: in a cluster with hostile accounts
            for cluster in account_clusters.get(key, []):
                cluster_has_hostile = any(
                    f"{cluster['platform']}:{a}" in hostile_accounts
                    for a in cluster["accounts"]
                )
                if cluster_has_hostile:
                    risk += 0.3
                    break

            # 0.2 weight: title patterns similar to hostile patterns
            if hostile_title_words and profile["page_titles"]:
                account_words: set[str] = set()
                for title in profile["page_titles"]:
                    account_words.update(title.lower().split())
                if account_words:
                    intersection = account_words & hostile_title_words
                    union = account_words | hostile_title_words
                    title_sim = len(intersection) / len(union) if union else 0.0
                    if title_sim > 0.3:
                        risk += 0.2

            # 0.2 weight: same platform as hostile accounts
            if profile["platform"] in hostile_platforms:
                risk += 0.2

            if risk > 0.6:
                recommendations.append({
                    "rec_type": "priority_source",
                    "target_platform": profile["platform"],
                    "target_entity": profile["account"],
                    "current_value": {"priority": "normal", "risk_score": round(risk, 2)},
                    "proposed_value": {
                        "action": "priority_scan",
                        "account": profile["account"],
                        "platform": profile["platform"],
                    },
                    "reasoning": (
                        f"New account '{profile['account']}' on {profile['platform']} has {profile['match_count']} matches "
                        f"and a risk score of {risk:.2f} based on behavioral similarity to known hostile accounts."
                    ),
                    "expected_impact": "Earlier detection of potential matches from high-risk new account",
                    "confidence": min(0.85, risk),
                    "risk_level": "low",
                    "supporting_data": {
                        "risk_score": round(risk, 2),
                        "match_count": profile["match_count"],
                        "account": profile["account"],
                        "platform": profile["platform"],
                    },
                })

        return recommendations

    def _recommend_hostile_flags(self, hostile: list[dict]) -> list[dict]:
        """Generate recommendations to flag hostile accounts."""
        recommendations = []

        for h in hostile:
            recommendations.append({
                "rec_type": "hostile_account_flag",
                "target_platform": h["platform"],
                "target_entity": h["account"],
                "current_value": {"flagged": False},
                "proposed_value": {
                    "action": "flag_hostile",
                    "account": h["account"],
                    "platform": h["platform"],
                },
                "reasoning": (
                    f"Account '{h['account']}' on {h['platform']} has {h['match_count']} confirmed matches "
                    f"affecting {h['contributors_affected']} contributor(s). "
                    + (f"Primary AI generator: {h['top_generator']}. " if h["top_generator"] else "")
                    + "Flagging enables priority monitoring."
                ),
                "expected_impact": f"Priority scanning of {h['match_count']}+ content items from this account",
                "confidence": min(0.9, 0.5 + h["match_count"] / 10),
                "risk_level": "low",
                "supporting_data": h["evidence"],
            })

        return recommendations

    def _recommend_priority_sources(self, clusters: list[dict], hostile: list[dict]) -> list[dict]:
        """Recommend priority scanning for accounts in hostile clusters."""
        recommendations = []
        hostile_accounts = {h["account"] for h in hostile}

        for cluster in clusters:
            # Find non-hostile accounts in the cluster that should get priority scanning
            new_targets = [a for a in cluster["accounts"] if a not in hostile_accounts]
            if not new_targets:
                continue

            for account in new_targets:
                recommendations.append({
                    "rec_type": "priority_source",
                    "target_platform": cluster["platform"],
                    "target_entity": account,
                    "current_value": {"priority": "normal"},
                    "proposed_value": {
                        "action": "priority_scan",
                        "account": account,
                        "platform": cluster["platform"],
                    },
                    "reasoning": (
                        f"Account '{account}' on {cluster['platform']} shares a cluster with "
                        f"hostile accounts (common {cluster['cluster_type']}: {cluster.get('generator', 'N/A')}). "
                        f"Priority scanning recommended."
                    ),
                    "expected_impact": "Earlier detection of potential matches from linked accounts",
                    "confidence": 0.6,
                    "risk_level": "low",
                    "supporting_data": {
                        "cluster_type": cluster["cluster_type"],
                        "cluster_accounts": cluster["accounts"],
                        "cluster_matches": cluster["total_matches"],
                    },
                })

        return recommendations

    async def _persist_hostile_accounts(self, hostile: list[dict]) -> None:
        """Store hostile account data in ml_hostile_accounts table."""
        try:
            async with async_session() as session:
                for h in hostile:
                    await session.execute(
                        text("""
                            INSERT INTO ml_hostile_accounts
                                (platform, account_handle, match_count, evidence, flagged_at)
                            VALUES (:platform, :account, :match_count, :evidence, :now)
                            ON CONFLICT (platform, account_handle)
                            DO UPDATE SET
                                match_count = :match_count,
                                evidence = :evidence,
                                flagged_at = :now
                        """),
                        {
                            "platform": h["platform"],
                            "account": h["account"],
                            "match_count": h["match_count"],
                            "evidence": json.dumps(h["evidence"]) if isinstance(h.get("evidence"), dict) else "{}",
                            "now": datetime.now(timezone.utc),
                        },
                    )
                await session.commit()
        except Exception as e:
            log.error("hostile_account_persist_error", error=str(e))
