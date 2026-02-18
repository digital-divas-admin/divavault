"""Tests for the Section Ranker analyzer utilities and scoring logic."""

import pytest
import numpy as np

from src.intelligence.analyzers.sections import (
    jaccard_similarity,
    normalize_values,
    risk_keyword_score,
    HIGH_RISK_KEYWORDS,
    MEDIUM_RISK_KEYWORDS,
    LOW_RISK_KEYWORDS,
    SectionRanker,
)


# ---------------------------------------------------------------------------
# risk_keyword_score
# ---------------------------------------------------------------------------

class TestRiskKeywordScore:
    @pytest.mark.parametrize("keyword", HIGH_RISK_KEYWORDS)
    def test_high_risk_keywords(self, keyword):
        assert risk_keyword_score(f"Some {keyword} section") == 1.0

    @pytest.mark.parametrize("keyword", MEDIUM_RISK_KEYWORDS)
    def test_medium_risk_keywords(self, keyword):
        assert risk_keyword_score(f"A {keyword} gallery") == 0.7

    @pytest.mark.parametrize("keyword", LOW_RISK_KEYWORDS)
    def test_low_risk_keywords(self, keyword):
        assert risk_keyword_score(f"Best {keyword} art") == 0.0

    def test_unknown_keyword(self):
        assert risk_keyword_score("random misc content") == 0.3

    def test_case_insensitive(self):
        assert risk_keyword_score("DEEPFAKE Collection") == 1.0
        assert risk_keyword_score("Portrait Gallery") == 0.7

    def test_none_input(self):
        assert risk_keyword_score(None) == 0.3

    def test_empty_input(self):
        assert risk_keyword_score("") == 0.3

    def test_priority_high_over_medium(self):
        """If both high and medium keywords present, high wins (checked first)."""
        assert risk_keyword_score("celebrity portrait collection") == 1.0


# ---------------------------------------------------------------------------
# normalize_values
# ---------------------------------------------------------------------------

class TestNormalizeValues:
    def test_basic_normalization(self):
        result = normalize_values([0, 50, 100])
        assert result == pytest.approx([0.0, 0.5, 1.0])

    def test_all_same_values(self):
        result = normalize_values([5, 5, 5])
        assert result == [0.5, 0.5, 0.5]

    def test_empty_list(self):
        assert normalize_values([]) == []

    def test_single_value(self):
        result = normalize_values([42])
        assert result == [0.5]

    def test_negative_values(self):
        result = normalize_values([-10, 0, 10])
        assert result == pytest.approx([0.0, 0.5, 1.0])


# ---------------------------------------------------------------------------
# jaccard_similarity
# ---------------------------------------------------------------------------

class TestJaccardSimilarity:
    def test_identical_strings(self):
        assert jaccard_similarity("hello world", "hello world") == 1.0

    def test_completely_different(self):
        assert jaccard_similarity("hello world", "foo bar") == 0.0

    def test_partial_overlap(self):
        # "hello" in common, union = {hello, world, there} = 3
        sim = jaccard_similarity("hello world", "hello there")
        assert sim == pytest.approx(1 / 3)

    def test_case_insensitive(self):
        assert jaccard_similarity("Hello World", "hello world") == 1.0

    def test_empty_string(self):
        assert jaccard_similarity("", "hello") == 0.0
        assert jaccard_similarity("hello", "") == 0.0

    def test_single_word(self):
        assert jaccard_similarity("hello", "hello") == 1.0


# ---------------------------------------------------------------------------
# SectionRanker configuration
# ---------------------------------------------------------------------------

class TestSectionRankerConfig:
    def test_schedule(self):
        ranker = SectionRanker()
        assert ranker.get_schedule_hours() == 24.0

    def test_min_signals(self):
        ranker = SectionRanker()
        assert ranker.get_minimum_signals() == 30

    def test_name(self):
        ranker = SectionRanker()
        assert ranker.get_name() == "Section Ranker"
