"""Tests for Source Intelligence analyzer: account profiling, hostile detection,
title clustering, cross-account dedup, and new-account risk scoring."""

import pytest
from collections import Counter
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.intelligence.analyzers.sources import SourceIntelligence, MIN_MATCHES_HOSTILE


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def analyzer():
    return SourceIntelligence()


def make_match(
    source_account="user1",
    platform="civitai",
    ai_generator="stable_diffusion",
    page_title="AI Portrait Collection",
    source_url="https://civitai.com/images/123",
    page_url="https://civitai.com/models/456",
    contributor_id=None,
    is_known_account=False,
):
    return {
        "match_id": str(uuid4()),
        "source_account": source_account,
        "is_known_account": is_known_account,
        "contributor_id": str(contributor_id or uuid4()),
        "similarity_score": 0.85,
        "is_ai_generated": True,
        "ai_generator": ai_generator,
        "platform": platform,
        "page_url": page_url,
        "page_title": page_title,
        "source_url": source_url,
    }


# ---------------------------------------------------------------------------
# URL extraction
# ---------------------------------------------------------------------------

class TestExtractAccountFromUrl:
    def test_civitai_url(self, analyzer):
        url = "https://civitai.com/user/badactor42/images"
        assert analyzer._extract_account_from_url(url, "civitai") == "badactor42"

    def test_deviantart_url(self, analyzer):
        url = "https://www.deviantart.com/deepfakeartist/art/portrait-123"
        assert analyzer._extract_account_from_url(url, "deviantart") == "deepfakeartist"

    def test_reddit_url(self, analyzer):
        url = "https://reddit.com/user/generator_guy/submitted"
        assert analyzer._extract_account_from_url(url, "reddit") == "generator_guy"

    def test_reddit_u_prefix(self, analyzer):
        url = "https://reddit.com/u/ai_poster"
        assert analyzer._extract_account_from_url(url, "reddit") == "ai_poster"

    def test_no_match(self, analyzer):
        assert analyzer._extract_account_from_url("https://example.com", "civitai") is None

    def test_empty_url(self, analyzer):
        assert analyzer._extract_account_from_url("", "civitai") is None

    def test_none_url(self, analyzer):
        assert analyzer._extract_account_from_url(None, "civitai") is None


# ---------------------------------------------------------------------------
# Account profile building
# ---------------------------------------------------------------------------

class TestBuildAccountProfiles:
    def test_groups_by_account(self, analyzer):
        matches = [
            make_match(source_account="alice", platform="civitai"),
            make_match(source_account="alice", platform="civitai"),
            make_match(source_account="bob", platform="civitai"),
        ]
        profiles = analyzer._build_account_profiles(matches)
        assert "civitai:alice" in profiles
        assert "civitai:bob" in profiles
        assert profiles["civitai:alice"]["match_count"] == 2
        assert profiles["civitai:bob"]["match_count"] == 1

    def test_tracks_contributors_affected(self, analyzer):
        c1, c2 = uuid4(), uuid4()
        matches = [
            make_match(source_account="alice", contributor_id=c1),
            make_match(source_account="alice", contributor_id=c2),
            make_match(source_account="alice", contributor_id=c1),  # dupe
        ]
        profiles = analyzer._build_account_profiles(matches)
        assert len(profiles["civitai:alice"]["contributors_affected"]) == 2

    def test_tracks_ai_generators(self, analyzer):
        matches = [
            make_match(source_account="alice", ai_generator="stable_diffusion"),
            make_match(source_account="alice", ai_generator="stable_diffusion"),
            make_match(source_account="alice", ai_generator="midjourney"),
        ]
        profiles = analyzer._build_account_profiles(matches)
        gens = profiles["civitai:alice"]["ai_generators"]
        assert gens["stable_diffusion"] == 2
        assert gens["midjourney"] == 1

    def test_collects_page_titles(self, analyzer):
        matches = [
            make_match(source_account="alice", page_title="Title A"),
            make_match(source_account="alice", page_title="Title B"),
        ]
        profiles = analyzer._build_account_profiles(matches)
        assert profiles["civitai:alice"]["page_titles"] == ["Title A", "Title B"]


# ---------------------------------------------------------------------------
# Hostile account detection
# ---------------------------------------------------------------------------

class TestIdentifyHostileAccounts:
    def test_flags_accounts_above_threshold(self, analyzer):
        profiles = {
            "civitai:badguy": {
                "account": "badguy",
                "platform": "civitai",
                "match_count": 5,
                "contributors_affected": {str(uuid4()), str(uuid4())},
                "ai_generators": Counter({"stable_diffusion": 3}),
                "page_titles": ["AI faces"],
                "is_known": False,
                "matches": [],
            },
        }
        hostile = analyzer._identify_hostile_accounts(profiles, set())
        assert len(hostile) == 1
        assert hostile[0]["account"] == "badguy"
        assert hostile[0]["match_count"] == 5

    def test_skips_known_accounts(self, analyzer):
        profiles = {
            "civitai:goodguy": {
                "account": "goodguy",
                "platform": "civitai",
                "match_count": 10,
                "contributors_affected": set(),
                "ai_generators": Counter(),
                "page_titles": [],
                "is_known": False,
                "matches": [],
            },
        }
        known = {"civitai:goodguy"}
        hostile = analyzer._identify_hostile_accounts(profiles, known)
        assert len(hostile) == 0

    def test_skips_is_known_flag(self, analyzer):
        profiles = {
            "civitai:self": {
                "account": "self",
                "platform": "civitai",
                "match_count": 10,
                "contributors_affected": set(),
                "ai_generators": Counter(),
                "page_titles": [],
                "is_known": True,
                "matches": [],
            },
        }
        hostile = analyzer._identify_hostile_accounts(profiles, set())
        assert len(hostile) == 0

    def test_below_threshold_not_flagged(self, analyzer):
        profiles = {
            "civitai:newbie": {
                "account": "newbie",
                "platform": "civitai",
                "match_count": 2,
                "contributors_affected": {str(uuid4())},
                "ai_generators": Counter(),
                "page_titles": [],
                "is_known": False,
                "matches": [],
            },
        }
        hostile = analyzer._identify_hostile_accounts(profiles, set())
        assert len(hostile) == 0


# ---------------------------------------------------------------------------
# Cluster detection — shared generator
# ---------------------------------------------------------------------------

class TestDetectClustersGenerator:
    def test_shared_generator_cluster(self, analyzer):
        profiles = {
            "civitai:alice": {
                "account": "alice", "platform": "civitai", "match_count": 3,
                "ai_generators": Counter({"stable_diffusion": 3}),
                "page_titles": ["Different title A"], "matches": [],
            },
            "civitai:bob": {
                "account": "bob", "platform": "civitai", "match_count": 2,
                "ai_generators": Counter({"stable_diffusion": 2}),
                "page_titles": ["Different title B"], "matches": [],
            },
        }
        clusters = analyzer._detect_clusters(profiles)
        gen_clusters = [c for c in clusters if c["cluster_type"] == "shared_generator"]
        assert len(gen_clusters) == 1
        assert set(gen_clusters[0]["accounts"]) == {"alice", "bob"}

    def test_no_generator_cluster_single_account(self, analyzer):
        profiles = {
            "civitai:solo": {
                "account": "solo", "platform": "civitai", "match_count": 3,
                "ai_generators": Counter({"midjourney": 3}),
                "page_titles": [], "matches": [],
            },
        }
        clusters = analyzer._detect_clusters(profiles)
        gen_clusters = [c for c in clusters if c["cluster_type"] == "shared_generator"]
        assert len(gen_clusters) == 0


# ---------------------------------------------------------------------------
# Cluster detection — shared titles (Fix 2)
# ---------------------------------------------------------------------------

class TestDetectClustersTitles:
    def test_similar_titles_cluster(self, analyzer):
        profiles = {
            "civitai:alice": {
                "account": "alice", "platform": "civitai", "match_count": 2,
                "ai_generators": Counter(),
                "page_titles": ["AI generated portrait realistic face"],
                "matches": [],
            },
            "civitai:bob": {
                "account": "bob", "platform": "civitai", "match_count": 2,
                "ai_generators": Counter(),
                "page_titles": ["AI generated portrait realistic look"],
                "matches": [],
            },
        }
        clusters = analyzer._detect_clusters(profiles)
        title_clusters = [c for c in clusters if c["cluster_type"] == "shared_titles"]
        assert len(title_clusters) == 1
        assert set(title_clusters[0]["accounts"]) == {"alice", "bob"}

    def test_dissimilar_titles_no_cluster(self, analyzer):
        profiles = {
            "civitai:alice": {
                "account": "alice", "platform": "civitai", "match_count": 2,
                "ai_generators": Counter(),
                "page_titles": ["Anime landscape mountain"],
                "matches": [],
            },
            "civitai:bob": {
                "account": "bob", "platform": "civitai", "match_count": 2,
                "ai_generators": Counter(),
                "page_titles": ["AI generated portrait realistic face"],
                "matches": [],
            },
        }
        clusters = analyzer._detect_clusters(profiles)
        title_clusters = [c for c in clusters if c["cluster_type"] == "shared_titles"]
        assert len(title_clusters) == 0


# ---------------------------------------------------------------------------
# Cluster detection — shared content (Fix 2)
# ---------------------------------------------------------------------------

class TestDetectClustersContent:
    def test_cross_account_shared_url(self, analyzer):
        shared_url = "https://civitai.com/images/shared123"
        profiles = {
            "civitai:alice": {
                "account": "alice", "platform": "civitai", "match_count": 2,
                "ai_generators": Counter(), "page_titles": [],
                "matches": [
                    make_match(source_account="alice", source_url=shared_url),
                ],
            },
            "civitai:bob": {
                "account": "bob", "platform": "civitai", "match_count": 2,
                "ai_generators": Counter(), "page_titles": [],
                "matches": [
                    make_match(source_account="bob", source_url=shared_url),
                ],
            },
        }
        clusters = analyzer._detect_clusters(profiles)
        content_clusters = [c for c in clusters if c["cluster_type"] == "shared_content"]
        assert len(content_clusters) == 1
        assert set(content_clusters[0]["accounts"]) == {"alice", "bob"}

    def test_no_shared_content(self, analyzer):
        profiles = {
            "civitai:alice": {
                "account": "alice", "platform": "civitai", "match_count": 1,
                "ai_generators": Counter(), "page_titles": [],
                "matches": [
                    make_match(source_account="alice", source_url="https://civitai.com/images/111"),
                ],
            },
            "civitai:bob": {
                "account": "bob", "platform": "civitai", "match_count": 1,
                "ai_generators": Counter(), "page_titles": [],
                "matches": [
                    make_match(source_account="bob", source_url="https://civitai.com/images/222"),
                ],
            },
        }
        clusters = analyzer._detect_clusters(profiles)
        content_clusters = [c for c in clusters if c["cluster_type"] == "shared_content"]
        assert len(content_clusters) == 0


# ---------------------------------------------------------------------------
# New account risk scoring (Fix 3)
# ---------------------------------------------------------------------------

class TestScoreNewAccounts:
    def _make_profiles_and_hostile(self):
        """Create test profiles with hostile and new accounts."""
        profiles = {
            "civitai:hostile1": {
                "account": "hostile1", "platform": "civitai", "match_count": 5,
                "ai_generators": Counter({"stable_diffusion": 5}),
                "page_titles": ["deepfake portrait realistic face"],
                "is_known": False, "matches": [],
            },
            "civitai:suspicious_new": {
                "account": "suspicious_new", "platform": "civitai", "match_count": 2,
                "ai_generators": Counter({"stable_diffusion": 2}),
                "page_titles": ["deepfake portrait realistic generation"],
                "is_known": False, "matches": [],
            },
            "deviantart:clean": {
                "account": "clean", "platform": "deviantart", "match_count": 1,
                "ai_generators": Counter({"midjourney": 1}),
                "page_titles": ["nature photography landscape"],
                "is_known": False, "matches": [],
            },
        }
        hostile = [{
            "account": "hostile1", "platform": "civitai", "match_count": 5,
            "contributors_affected": 3, "top_generator": "stable_diffusion",
            "evidence": {},
        }]
        clusters = [{
            "platform": "civitai",
            "cluster_type": "shared_generator",
            "generator": "stable_diffusion",
            "accounts": ["hostile1", "suspicious_new"],
            "total_matches": 7,
        }]
        return profiles, hostile, clusters

    def test_high_risk_score(self, analyzer):
        profiles, hostile, clusters = self._make_profiles_and_hostile()
        recs = analyzer._score_new_accounts(profiles, hostile, clusters, set())
        # suspicious_new: same generator (0.3) + cluster with hostile (0.3) + same platform (0.2) = 0.8
        suspicious_recs = [r for r in recs if r["target_entity"] == "suspicious_new"]
        assert len(suspicious_recs) == 1
        risk = suspicious_recs[0]["current_value"]["risk_score"]
        assert risk > 0.6

    def test_low_risk_no_recommendation(self, analyzer):
        profiles, hostile, clusters = self._make_profiles_and_hostile()
        recs = analyzer._score_new_accounts(profiles, hostile, clusters, set())
        clean_recs = [r for r in recs if r["target_entity"] == "clean"]
        # clean: different platform, different generator = low risk
        assert len(clean_recs) == 0

    def test_hostile_accounts_excluded(self, analyzer):
        profiles, hostile, clusters = self._make_profiles_and_hostile()
        recs = analyzer._score_new_accounts(profiles, hostile, clusters, set())
        hostile_recs = [r for r in recs if r["target_entity"] == "hostile1"]
        assert len(hostile_recs) == 0

    def test_known_accounts_excluded(self, analyzer):
        profiles, hostile, clusters = self._make_profiles_and_hostile()
        known = {"civitai:suspicious_new"}
        recs = analyzer._score_new_accounts(profiles, hostile, clusters, known)
        assert len([r for r in recs if r["target_entity"] == "suspicious_new"]) == 0


# ---------------------------------------------------------------------------
# Recommendation generation
# ---------------------------------------------------------------------------

class TestRecommendHostileFlags:
    def test_generates_recommendation(self, analyzer):
        hostile = [{
            "account": "badguy", "platform": "civitai", "match_count": 5,
            "contributors_affected": 2, "top_generator": "stable_diffusion",
            "evidence": {"match_count": 5},
        }]
        recs = analyzer._recommend_hostile_flags(hostile)
        assert len(recs) == 1
        assert recs[0]["rec_type"] == "hostile_account_flag"
        assert recs[0]["target_entity"] == "badguy"
        assert recs[0]["risk_level"] == "low"

    def test_confidence_scales_with_matches(self, analyzer):
        hostile = [
            {"account": "a", "platform": "x", "match_count": 3, "contributors_affected": 1,
             "top_generator": None, "evidence": {}},
            {"account": "b", "platform": "x", "match_count": 15, "contributors_affected": 5,
             "top_generator": "sd", "evidence": {}},
        ]
        recs = analyzer._recommend_hostile_flags(hostile)
        assert recs[1]["confidence"] > recs[0]["confidence"]


class TestRecommendPrioritySources:
    def test_non_hostile_in_cluster_gets_priority(self, analyzer):
        clusters = [{
            "platform": "civitai",
            "cluster_type": "shared_generator",
            "generator": "stable_diffusion",
            "accounts": ["hostile1", "new_suspect"],
            "total_matches": 8,
        }]
        hostile = [{"account": "hostile1"}]
        recs = analyzer._recommend_priority_sources(clusters, hostile)
        assert len(recs) == 1
        assert recs[0]["target_entity"] == "new_suspect"
        assert recs[0]["rec_type"] == "priority_source"


# ---------------------------------------------------------------------------
# Full analyze end-to-end (mocked DB)
# ---------------------------------------------------------------------------

class TestSourceIntelligenceAnalyze:
    @pytest.mark.asyncio
    async def test_analyze_with_insufficient_data(self, analyzer):
        with patch.object(analyzer, "_load_confirmed_matches", return_value=[]):
            recs = await analyzer.analyze()
        assert recs == []

    @pytest.mark.asyncio
    async def test_analyze_produces_hostile_and_priority_recs(self, analyzer):
        c1, c2, c3 = uuid4(), uuid4(), uuid4()
        matches = (
            [make_match(source_account="bad1", contributor_id=c) for c in [c1, c2, c3]]  # 3 matches
            + [make_match(source_account="bad1", contributor_id=c1)]  # 4th
            + [make_match(source_account="associate", ai_generator="stable_diffusion")]
            + [make_match(source_account="bad1", ai_generator="stable_diffusion")]
        )

        with patch.object(analyzer, "_load_confirmed_matches", return_value=matches), \
             patch.object(analyzer, "_load_known_accounts", return_value=set()), \
             patch.object(analyzer, "_persist_hostile_accounts", return_value=None):
            recs = await analyzer.analyze()

        rec_types = [r["rec_type"] for r in recs]
        # bad1 should be hostile (4+ matches), associate may get priority
        assert "hostile_account_flag" in rec_types
