"""Tests for the Applier: recommendation application logic."""

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.intelligence.applier import Applier, AUTO_APPLY_ELIGIBLE, HUMAN_APPROVAL_REQUIRED


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

class TestConfiguration:
    def test_auto_apply_includes_synthetic_cleanup(self):
        assert "synthetic_cleanup" in AUTO_APPLY_ELIGIBLE

    def test_auto_apply_includes_low_risk_types(self):
        assert "search_term_add" in AUTO_APPLY_ELIGIBLE
        assert "crawl_schedule_change" in AUTO_APPLY_ELIGIBLE

    def test_human_approval_required_types(self):
        assert "threshold_change" in HUMAN_APPROVAL_REQUIRED
        assert "section_toggle" in HUMAN_APPROVAL_REQUIRED
        assert "fp_suppression" in HUMAN_APPROVAL_REQUIRED
        assert "hostile_account_flag" in HUMAN_APPROVAL_REQUIRED


# ---------------------------------------------------------------------------
# Apply one — dispatch
# ---------------------------------------------------------------------------

class TestApplyOne:
    @pytest.fixture
    def applier(self):
        return Applier()

    def _make_rec(self, rec_type, proposed=None, **kwargs):
        rec = MagicMock()
        rec.id = uuid4()
        rec.recommendation_type = rec_type
        rec.payload = {"proposed_value": proposed or {}}
        rec.status = "approved"
        rec.target_platform = kwargs.get("platform", "civitai")
        rec.target_entity = kwargs.get("entity", "test_entity")
        rec.reasoning = "Test reasoning"
        rec.supporting_data = kwargs.get("supporting_data", {})
        rec.risk_level = kwargs.get("risk_level", "low")
        rec.confidence = kwargs.get("confidence", 0.9)
        return rec

    @pytest.mark.asyncio
    async def test_dispatches_threshold_change(self, applier):
        rec = self._make_rec("threshold_change", {"low": 0.52, "medium": 0.67, "high": 0.87})
        with patch.object(applier, "_apply_threshold_change", new_callable=AsyncMock) as mock_apply, \
             patch("src.intelligence.applier.async_session") as mock_sess, \
             patch("src.intelligence.applier.observer") as mock_obs:
            mock_session = AsyncMock()
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=False)
            mock_sess.return_value = mock_session
            mock_obs.emit = AsyncMock()

            await applier._apply_one(rec)
            mock_apply.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatches_synthetic_cleanup(self, applier):
        rec = self._make_rec("synthetic_cleanup", {"action": "remove_synthetic", "synthetic_count": 5})
        with patch.object(applier, "_apply_synthetic_cleanup", new_callable=AsyncMock) as mock_apply, \
             patch("src.intelligence.applier.async_session") as mock_sess, \
             patch("src.intelligence.applier.observer") as mock_obs:
            mock_session = AsyncMock()
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=False)
            mock_sess.return_value = mock_session
            mock_obs.emit = AsyncMock()

            await applier._apply_one(rec)
            mock_apply.assert_called_once()


# ---------------------------------------------------------------------------
# Synthetic cleanup (Fix 4)
# ---------------------------------------------------------------------------

class TestApplySyntheticCleanup:
    @pytest.mark.asyncio
    async def test_deletes_synthetic_users(self):
        applier = Applier()
        rec = MagicMock()
        proposed = {"action": "remove_synthetic", "synthetic_count": 5}

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [(uuid4(),) for _ in range(5)]
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.applier.async_session", return_value=mock_session):
            await applier._apply_synthetic_cleanup(rec, proposed)

        # Should have called execute twice (delete embeddings + delete contributors)
        assert mock_session.execute.call_count == 2
        mock_session.commit.assert_called_once()


# ---------------------------------------------------------------------------
# FP suppression
# ---------------------------------------------------------------------------

class TestApplyFpSuppression:
    @pytest.mark.asyncio
    async def test_inserts_suppression_rule(self):
        applier = Applier()
        rec = MagicMock()
        rec.id = uuid4()
        rec.target_platform = "civitai"
        rec.payload = {"current_value": {"dismissal_count": 10}}
        rec.reasoning = "Repeat false positive"

        proposed = {
            "contributor_id": str(uuid4()),
            "platform": "civitai",
        }

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.applier.async_session", return_value=mock_session):
            await applier._apply_fp_suppression(rec, proposed)

        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()


# ---------------------------------------------------------------------------
# Hostile account flag
# ---------------------------------------------------------------------------

class TestApplyHostileAccountFlag:
    @pytest.mark.asyncio
    async def test_inserts_hostile_account(self):
        applier = Applier()
        rec = MagicMock()
        rec.id = uuid4()
        rec.target_platform = "civitai"
        rec.supporting_data = {"match_count": 5}

        proposed = {"account": "badguy", "platform": "civitai"}

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.applier.async_session", return_value=mock_session):
            await applier._apply_hostile_account_flag(rec, proposed)

        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()


# ---------------------------------------------------------------------------
# Auto-approvable filtering
# ---------------------------------------------------------------------------

class TestAutoApprovable:
    @pytest.mark.asyncio
    async def test_filters_eligible_types(self):
        applier = Applier()

        rec_eligible = MagicMock()
        rec_eligible.recommendation_type = "search_term_add"
        rec_eligible.status = "pending"
        rec_eligible.risk_level = "low"
        rec_eligible.confidence = 0.9

        rec_ineligible = MagicMock()
        rec_ineligible.recommendation_type = "threshold_change"
        rec_ineligible.status = "pending"
        rec_ineligible.risk_level = "low"
        rec_ineligible.confidence = 0.9

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [rec_eligible, rec_ineligible]
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("src.intelligence.applier.async_session", return_value=mock_session):
            result = await applier._get_auto_approvable()

        assert len(result) == 1
        assert result[0].recommendation_type == "search_term_add"
