"""Applier: applies human-approved (and auto-approved) ML recommendations.

Called from the scheduler loop after recommender.tick(). Queries for approved
recommendations and applies the changes based on rec_type. Supports auto-apply
for low-risk recommendations when enabled via config.
"""

import json
from datetime import datetime, timezone

from sqlalchemy import select, text

from src.config import settings
from src.db.connection import async_session
from src.db.models import MLModelState, MLRecommendation, MLSectionProfile
from src.intelligence.observer import observer
from src.utils.logging import get_logger

log = get_logger("applier")

# Recommendation types eligible for auto-apply (low risk only)
AUTO_APPLY_ELIGIBLE = {"search_term_add", "crawl_schedule_change", "synthetic_cleanup"}

# Recommendation types that always require human approval
HUMAN_APPROVAL_REQUIRED = {"threshold_change", "section_toggle", "fp_suppression", "hostile_account_flag"}


class Applier:
    """Applies approved ML recommendations."""

    async def apply_approved(self) -> None:
        """Query approved recommendations and apply them."""
        # 1. Apply human-approved recommendations
        async with async_session() as session:
            result = await session.execute(
                select(MLRecommendation)
                .where(MLRecommendation.status == "approved")
                .order_by(MLRecommendation.created_at)
            )
            approved = list(result.scalars().all())

        # 2. Auto-apply low-risk recommendations if enabled
        if settings.auto_apply_low_risk:
            auto_approved = await self._get_auto_approvable()
            approved.extend(auto_approved)

        if not approved:
            return

        log.info("applier_start", count=len(approved))

        for rec in approved:
            try:
                await self._apply_one(rec)
                log.info(
                    "recommendation_applied",
                    rec_id=str(rec.id),
                    rec_type=rec.recommendation_type,
                )
            except Exception as e:
                log.error(
                    "recommendation_apply_failed",
                    rec_id=str(rec.id),
                    error=str(e),
                )
                # Mark as failed
                async with async_session() as session:
                    await session.execute(
                        text("""
                            UPDATE ml_recommendations
                            SET status = 'failed'
                            WHERE id = :id
                        """),
                        {"id": str(rec.id)},
                    )
                    await session.commit()

    async def _get_auto_approvable(self) -> list[MLRecommendation]:
        """Find pending recommendations eligible for auto-apply."""
        async with async_session() as session:
            result = await session.execute(
                select(MLRecommendation)
                .where(MLRecommendation.status == "pending")
                .where(MLRecommendation.risk_level == "low")
                .where(MLRecommendation.confidence >= 0.8)
                .order_by(MLRecommendation.created_at)
            )
            candidates = list(result.scalars().all())

        return [
            rec for rec in candidates
            if rec.recommendation_type in AUTO_APPLY_ELIGIBLE
        ]

    async def _apply_one(self, rec: MLRecommendation) -> None:
        """Apply a single approved recommendation based on its type."""
        rec_type = rec.recommendation_type
        payload = rec.payload or {}
        proposed = payload.get("proposed_value") or {}

        if rec_type == "threshold_change":
            await self._apply_threshold_change(rec, proposed)
        elif rec_type == "section_toggle":
            await self._apply_section_toggle(rec, proposed)
        elif rec_type == "search_term_remove":
            await self._apply_search_term_remove(rec, proposed)
        elif rec_type == "search_term_add":
            await self._apply_search_term_add(rec, proposed)
        elif rec_type == "crawl_schedule_change":
            await self._apply_crawl_schedule_change(rec, proposed)
        elif rec_type == "fp_suppression":
            await self._apply_fp_suppression(rec, proposed)
        elif rec_type == "hostile_account_flag":
            await self._apply_hostile_account_flag(rec, proposed)
        elif rec_type == "synthetic_cleanup":
            await self._apply_synthetic_cleanup(rec, proposed)
        elif rec_type == "priority_source":
            # Priority source is informational — just mark as applied
            log.info("priority_source_noted", account=proposed.get("account"), platform=rec.target_platform)
        else:
            log.warning("unknown_rec_type", rec_type=rec_type, rec_id=str(rec.id))

        # Determine final status label
        is_auto = rec.status == "pending"  # Was pending → auto-applied
        final_status = "auto_applied" if is_auto else "applied"

        # Mark as applied
        async with async_session() as session:
            await session.execute(
                text("""
                    UPDATE ml_recommendations
                    SET status = :status, applied_at = :now
                    WHERE id = :id
                """),
                {"status": final_status, "now": datetime.now(timezone.utc), "id": str(rec.id)},
            )
            await session.commit()

        # Emit observer signal
        try:
            await observer.emit("recommendation_applied", "recommendation", str(rec.id), {
                "rec_type": rec_type,
                "target_platform": rec.target_platform,
                "target_entity": rec.target_entity,
                "auto_applied": is_auto,
            })
        except Exception:
            pass

    async def _apply_threshold_change(self, rec: MLRecommendation, proposed: dict) -> None:
        """Apply threshold changes to ml_model_state."""
        async with async_session() as session:
            # Get current model state
            result = await session.execute(
                select(MLModelState)
                .where(MLModelState.model_name == "threshold_optimizer")
                .order_by(MLModelState.version.desc())
                .limit(1)
            )
            current = result.scalar_one_or_none()

            current_params = current.parameters if current else {}
            new_version = (current.version + 1) if current else 1

            # Merge thresholds
            new_params = dict(current_params)
            new_params["thresholds"] = proposed

            new_state = MLModelState(
                model_name="threshold_optimizer",
                version=new_version,
                parameters=new_params,
                metrics=current.metrics if current else {},
                trained_at=datetime.now(timezone.utc),
            )
            session.add(new_state)
            await session.commit()

        log.info("threshold_change_applied", new_thresholds=proposed, version=new_version)

    async def _apply_section_toggle(self, rec: MLRecommendation, proposed: dict) -> None:
        """Apply section toggle to ml_section_profiles."""
        scan_enabled = proposed.get("scan_enabled")
        if scan_enabled is None:
            log.warning("section_toggle_missing_value", rec_id=str(rec.id))
            return

        target_entity = rec.target_entity
        target_platform = rec.target_platform

        async with async_session() as session:
            # Find the section by section_id (or section_key) and platform
            result = await session.execute(
                select(MLSectionProfile)
                .where(MLSectionProfile.section_id == target_entity)
                .where(MLSectionProfile.platform == target_platform)
                .limit(1)
            )
            profile = result.scalar_one_or_none()

            if not profile:
                # Fallback: try section_key
                result = await session.execute(
                    select(MLSectionProfile)
                    .where(MLSectionProfile.section_key == target_entity)
                    .limit(1)
                )
                profile = result.scalar_one_or_none()

            if not profile:
                log.warning("section_not_found", target_entity=target_entity, platform=target_platform)
                return

            profile.scan_enabled = scan_enabled
            profile.last_updated_at = datetime.now(timezone.utc)
            await session.commit()

        log.info(
            "section_toggle_applied",
            section=target_entity,
            platform=target_platform,
            scan_enabled=scan_enabled,
        )

    async def _apply_search_term_remove(self, rec: MLRecommendation, proposed: dict) -> None:
        """Remove a search term from platform_crawl_schedule.search_terms."""
        term = proposed.get("term")
        if not term:
            log.warning("search_term_remove_missing_term", rec_id=str(rec.id))
            return

        platform = rec.target_platform
        async with async_session() as session:
            # Load current search terms
            result = await session.execute(
                text("SELECT search_terms FROM platform_crawl_schedule WHERE platform = :platform"),
                {"platform": platform},
            )
            row = result.fetchone()
            if not row:
                log.warning("platform_not_found", platform=platform)
                return

            current_terms = row[0]
            if isinstance(current_terms, list):
                new_terms = [t for t in current_terms if t != term]
            elif isinstance(current_terms, dict):
                terms_list = current_terms.get("terms", [])
                new_terms_list = [t for t in terms_list if t != term]
                new_terms = {**current_terms, "terms": new_terms_list}
            else:
                return

            await session.execute(
                text("UPDATE platform_crawl_schedule SET search_terms = :terms WHERE platform = :platform"),
                {"terms": json.dumps(new_terms), "platform": platform},
            )
            await session.commit()

        log.info("search_term_removed", term=term, platform=platform)

    async def _apply_search_term_add(self, rec: MLRecommendation, proposed: dict) -> None:
        """Append a search term to platform_crawl_schedule.search_terms."""
        term = proposed.get("term")
        if not term:
            log.warning("search_term_add_missing_term", rec_id=str(rec.id))
            return

        platform = rec.target_platform
        async with async_session() as session:
            result = await session.execute(
                text("SELECT search_terms FROM platform_crawl_schedule WHERE platform = :platform"),
                {"platform": platform},
            )
            row = result.fetchone()
            if not row:
                log.warning("platform_not_found", platform=platform)
                return

            current_terms = row[0]
            if isinstance(current_terms, list):
                if term not in current_terms:
                    current_terms.append(term)
                new_terms = current_terms
            elif isinstance(current_terms, dict):
                terms_list = current_terms.get("terms", [])
                if term not in terms_list:
                    terms_list.append(term)
                new_terms = {**current_terms, "terms": terms_list}
            else:
                new_terms = [term]

            await session.execute(
                text("UPDATE platform_crawl_schedule SET search_terms = :terms WHERE platform = :platform"),
                {"terms": json.dumps(new_terms), "platform": platform},
            )
            await session.commit()

        log.info("search_term_added", term=term, platform=platform)

    async def _apply_crawl_schedule_change(self, rec: MLRecommendation, proposed: dict) -> None:
        """Update crawl interval for a platform."""
        new_interval = proposed.get("crawl_interval_hours")
        if new_interval is None:
            log.warning("crawl_schedule_missing_interval", rec_id=str(rec.id))
            return

        platform = rec.target_platform
        async with async_session() as session:
            await session.execute(
                text("""
                    UPDATE platform_crawl_schedule
                    SET crawl_interval_hours = :interval
                    WHERE platform = :platform
                """),
                {"interval": int(new_interval), "platform": platform},
            )
            await session.commit()

        log.info("crawl_schedule_changed", platform=platform, new_interval=new_interval)

    async def _apply_fp_suppression(self, rec: MLRecommendation, proposed: dict) -> None:
        """Add a suppression rule for a repeat false positive pair."""
        contributor_id = proposed.get("contributor_id")
        platform = proposed.get("platform") or rec.target_platform

        if not contributor_id:
            log.warning("fp_suppression_missing_contributor", rec_id=str(rec.id))
            return

        dismissal_count = (rec.payload or {}).get("current_value", {}).get("dismissal_count", 0)

        async with async_session() as session:
            await session.execute(
                text("""
                    INSERT INTO ml_suppression_rules
                        (contributor_id, platform, dismissal_count, reason)
                    VALUES (:contributor_id, :platform, :dismissal_count, :reason)
                    ON CONFLICT DO NOTHING
                """),
                {
                    "contributor_id": contributor_id,
                    "platform": platform,
                    "dismissal_count": dismissal_count,
                    "reason": rec.reasoning or "Repeat false positive pattern detected",
                },
            )
            await session.commit()

        log.info("fp_suppression_applied", contributor_id=contributor_id[:8], platform=platform)

    async def _apply_hostile_account_flag(self, rec: MLRecommendation, proposed: dict) -> None:
        """Flag an account as hostile in ml_hostile_accounts."""
        account = proposed.get("account")
        platform = proposed.get("platform") or rec.target_platform

        if not account:
            log.warning("hostile_flag_missing_account", rec_id=str(rec.id))
            return

        async with async_session() as session:
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
                    "platform": platform,
                    "account": account,
                    "match_count": rec.supporting_data.get("match_count", 0) if rec.supporting_data else 0,
                    "evidence": json.dumps(rec.supporting_data or {}),
                    "now": datetime.now(timezone.utc),
                },
            )
            await session.commit()

        log.info("hostile_account_flagged", account=account, platform=platform)

    async def _apply_synthetic_cleanup(self, rec: MLRecommendation, proposed: dict) -> None:
        """Remove synthetic test users and their embeddings."""
        async with async_session() as session:
            # Delete contributor_embeddings for synthetic users
            await session.execute(
                text("""
                    DELETE FROM contributor_embeddings
                    WHERE contributor_id IN (
                        SELECT id FROM contributors WHERE test_user_type = 'synthetic'
                    )
                """)
            )
            # Delete synthetic contributors
            result = await session.execute(
                text("""
                    DELETE FROM contributors WHERE test_user_type = 'synthetic'
                    RETURNING id
                """)
            )
            deleted_ids = result.fetchall()
            await session.commit()

        log.info("synthetic_cleanup_applied", deleted_count=len(deleted_ids))
