"""Test user seeding infrastructure.

Three test user types:
- Seeded: real person with real photos, enters normal ingest pipeline
- Honeypot: seeded contributor with content deliberately planted on platforms
- Synthetic: generated embedding only, no real person (false-positive rate testing)

Usage:
    from src.seeding.seed_manager import seed_manager

    result = await seed_manager.create_seeded_contributor(
        full_name="Test User",
        email="test@consentedai.com",
        photo_paths=[{"bucket": "capture-uploads", "file_path": "test/photo1.jpg"}],
    )
"""

import uuid
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import and_, select, text, update

from src.db.connection import async_session
from src.db.models import (
    CaptureSession,
    Contributor,
    ContributorEmbedding,
    ContributorImage,
    DiscoveredImage,
    Match,
    ScanSchedule,
    TestHoneypotItem,
)
from src.intelligence.observer import observer
from src.utils.logging import get_logger

log = get_logger("seed_manager")


class SeedManager:
    """Manages test user seeding operations."""

    async def create_seeded_contributor(
        self,
        full_name: str,
        email: str,
        photo_paths: list[dict],
        subscription_tier: str = "premium",
    ) -> dict:
        """Create a seeded test contributor with photos queued for embedding.

        Args:
            full_name: Display name for the contributor.
            email: Email address.
            photo_paths: List of dicts with 'bucket' and 'file_path' keys.
            subscription_tier: Subscription tier (default: premium).

        Returns:
            Dict with contributor_id and images_queued count.
        """
        contributor_id = uuid.uuid4()
        session_id = uuid.uuid4()

        async with async_session() as session:
            # Create contributor
            contributor = Contributor(
                id=contributor_id,
                full_name=full_name,
                email=email,
                verification_status="approved",
                subscription_tier=subscription_tier,
                consent_given=True,
                onboarding_completed=True,
                is_test_user=True,
                test_user_type="seeded",
            )
            session.add(contributor)

            # Create capture session
            capture_session = CaptureSession(
                id=session_id,
                contributor_id=contributor_id,
                session_type="onboarding",
                status="completed",
                images_captured=len(photo_paths),
                images_required=len(photo_paths),
                completed_at=datetime.now(timezone.utc),
            )
            session.add(capture_session)

            # Create image records for each photo
            for photo in photo_paths:
                image = ContributorImage(
                    contributor_id=contributor_id,
                    session_id=session_id,
                    capture_step="front_neutral",
                    file_path=photo["file_path"],
                    bucket=photo["bucket"],
                    embedding_status="pending",
                )
                session.add(image)

            await session.commit()

        log.info(
            "seeded_contributor_created",
            contributor_id=str(contributor_id),
            images=len(photo_paths),
        )

        try:
            await observer.emit("test_user_created", "contributor", str(contributor_id), {
                "type": "seeded",
                "images_queued": len(photo_paths),
            })
        except Exception:
            pass

        return {
            "contributor_id": str(contributor_id),
            "images_queued": len(photo_paths),
        }

    async def create_honeypot_item(
        self,
        contributor_id: str,
        platform: str,
        planted_url: str,
        content_type: str,
        difficulty: str,
        generation_method: str | None = None,
        expected_similarity_range: tuple[float, float] = (0.70, 0.95),
    ) -> dict:
        """Register a honeypot item planted on a platform.

        Args:
            contributor_id: UUID of the seeded contributor.
            platform: Platform where content was planted.
            planted_url: URL of the planted content.
            content_type: Type of content (image, video, model, etc.).
            difficulty: Detection difficulty (easy, medium, hard).
            generation_method: How the content was generated.
            expected_similarity_range: Expected similarity score range.

        Returns:
            Dict with honeypot_id.
        """
        async with async_session() as session:
            item = TestHoneypotItem(
                contributor_id=uuid.UUID(contributor_id),
                platform=platform,
                planted_url=planted_url,
                content_type=content_type,
                generation_method=generation_method,
                difficulty=difficulty,
                expected_similarity_min=expected_similarity_range[0],
                expected_similarity_max=expected_similarity_range[1],
            )
            session.add(item)
            await session.flush()
            honeypot_id = str(item.id)
            await session.commit()

        log.info(
            "honeypot_planted",
            honeypot_id=honeypot_id,
            platform=platform,
            difficulty=difficulty,
        )

        try:
            await observer.emit("honeypot_planted", "honeypot", honeypot_id, {
                "contributor_id": contributor_id,
                "platform": platform,
                "difficulty": difficulty,
            })
        except Exception:
            pass

        return {"honeypot_id": honeypot_id}

    async def check_honeypot_detection(self) -> dict:
        """Check all undetected honeypot items against matches.

        Joins matches → discovered_images to check if source_url or page_url
        contains the planted_url.

        Returns:
            Detection report with rates, undetected items, breakdowns.
        """
        async with async_session() as session:
            # Get all undetected honeypot items
            result = await session.execute(
                select(TestHoneypotItem).where(TestHoneypotItem.detected == False)  # noqa: E712
            )
            undetected_items = list(result.scalars().all())

            newly_detected = 0
            for item in undetected_items:
                # Check if any match's discovered image URL contains the planted URL
                match_result = await session.execute(
                    text("""
                        SELECT m.id, m.similarity_score, m.created_at
                        FROM matches m
                        JOIN discovered_images di ON di.id = m.discovered_image_id
                        WHERE m.contributor_id = :contributor_id
                          AND (di.source_url LIKE :url_pattern OR di.page_url LIKE :url_pattern)
                        ORDER BY m.similarity_score DESC
                        LIMIT 1
                    """),
                    {
                        "contributor_id": item.contributor_id,
                        "url_pattern": f"%{item.planted_url}%",
                    },
                )
                match_row = match_result.first()

                if match_row:
                    await session.execute(
                        update(TestHoneypotItem)
                        .where(TestHoneypotItem.id == item.id)
                        .values(
                            detected=True,
                            detected_at=datetime.now(timezone.utc),
                            detected_match_id=match_row[0],
                            detected_similarity=match_row[1],
                        )
                    )
                    newly_detected += 1

            await session.commit()

            # Build full report
            all_result = await session.execute(select(TestHoneypotItem))
            all_items = list(all_result.scalars().all())

        total_planted = len(all_items)
        total_detected = sum(1 for i in all_items if i.detected)
        detection_rate = round(total_detected / total_planted, 4) if total_planted > 0 else 0.0

        undetected = [
            {
                "honeypot_id": str(i.id),
                "contributor_id": str(i.contributor_id),
                "platform": i.platform,
                "planted_url": i.planted_url,
                "difficulty": i.difficulty,
                "planted_at": i.planted_at.isoformat() if i.planted_at else None,
            }
            for i in all_items
            if not i.detected
        ]

        # By difficulty
        by_difficulty: dict[str, dict] = {}
        for i in all_items:
            d = i.difficulty
            if d not in by_difficulty:
                by_difficulty[d] = {"planted": 0, "detected": 0}
            by_difficulty[d]["planted"] += 1
            if i.detected:
                by_difficulty[d]["detected"] += 1
        for d in by_difficulty:
            p = by_difficulty[d]["planted"]
            det = by_difficulty[d]["detected"]
            by_difficulty[d]["rate"] = round(det / p, 4) if p > 0 else 0.0

        # By platform
        by_platform: dict[str, dict] = {}
        for i in all_items:
            p = i.platform
            if p not in by_platform:
                by_platform[p] = {"planted": 0, "detected": 0}
            by_platform[p]["planted"] += 1
            if i.detected:
                by_platform[p]["detected"] += 1
        for p in by_platform:
            planted = by_platform[p]["planted"]
            det = by_platform[p]["detected"]
            by_platform[p]["rate"] = round(det / planted, 4) if planted > 0 else 0.0

        # Average time to detect
        detect_times = []
        similarities = []
        for i in all_items:
            if i.detected and i.detected_at and i.planted_at:
                delta = (i.detected_at - i.planted_at).total_seconds() / 3600
                detect_times.append(delta)
            if i.detected and i.detected_similarity is not None:
                similarities.append(i.detected_similarity)

        avg_time = round(sum(detect_times) / len(detect_times), 2) if detect_times else None
        avg_similarity = round(sum(similarities) / len(similarities), 4) if similarities else None

        report = {
            "total_planted": total_planted,
            "total_detected": total_detected,
            "newly_detected": newly_detected,
            "detection_rate": detection_rate,
            "undetected": undetected,
            "by_difficulty": by_difficulty,
            "by_platform": by_platform,
            "avg_time_to_detect_hours": avg_time,
            "avg_similarity_score": avg_similarity,
        }

        log.info(
            "honeypot_check_complete",
            total=total_planted,
            detected=total_detected,
            newly_detected=newly_detected,
            rate=detection_rate,
        )

        return report

    async def generate_synthetic_embeddings(
        self,
        base_contributor_ids: list[str],
        count: int = 500,
        perturbation: float = 0.05,
    ) -> dict:
        """Generate synthetic contributors with perturbed embeddings.

        Creates fake contributors with embeddings derived from real ones
        for false-positive rate testing at scale.

        Args:
            base_contributor_ids: UUIDs of real contributors to base synthetics on.
            count: Number of synthetic contributors to create.
            perturbation: Standard deviation for embedding noise.

        Returns:
            Dict with count of created synthetics.
        """
        # Load primary embeddings for base contributors
        base_embeddings = []
        async with async_session() as session:
            for cid in base_contributor_ids:
                result = await session.execute(
                    text("""
                        SELECT embedding::text FROM contributor_embeddings
                        WHERE contributor_id = :cid AND is_primary = true
                        LIMIT 1
                    """),
                    {"cid": cid},
                )
                row = result.first()
                if row:
                    emb_str = row[0]
                    embedding = np.array(
                        [float(x) for x in emb_str.strip("[]").split(",")],
                        dtype=np.float32,
                    )
                    base_embeddings.append(embedding)

        if not base_embeddings:
            log.warning("no_base_embeddings_found", base_ids=base_contributor_ids)
            return {"created": 0}

        created = 0
        async with async_session() as session:
            for i in range(count):
                # Pick random base embedding
                base = base_embeddings[i % len(base_embeddings)]

                # Perturb and L2-normalize
                perturbed = base + np.random.normal(0, perturbation, 512).astype(np.float32)
                norm = np.linalg.norm(perturbed)
                if norm > 0:
                    perturbed = perturbed / norm

                contributor_id = uuid.uuid4()
                synthetic_email = f"synthetic-{contributor_id}@test.consentedai.com"

                # Create contributor
                contributor = Contributor(
                    id=contributor_id,
                    full_name=f"Synthetic #{i+1}",
                    email=synthetic_email,
                    verification_status="approved",
                    subscription_tier="free",
                    consent_given=True,
                    onboarding_completed=True,
                    is_test_user=True,
                    test_user_type="synthetic",
                )
                session.add(contributor)
                await session.flush()

                # Insert embedding directly (bypass ingest)
                embedding_row = ContributorEmbedding(
                    contributor_id=contributor_id,
                    embedding=perturbed.tolist(),
                    detection_score=0.99,
                    is_primary=True,
                    embedding_type="single",
                )
                session.add(embedding_row)
                await session.flush()

                # Init scan schedule
                from sqlalchemy.dialects.postgresql import insert
                stmt = insert(ScanSchedule).values(
                    contributor_id=contributor_id,
                    scan_type="reverse_image",
                    next_scan_at=datetime.now(timezone.utc),
                    scan_interval_hours=168,
                    priority=0,
                ).on_conflict_do_nothing()
                await session.execute(stmt)

                created += 1

                # Batch commit every 100
                if created % 100 == 0:
                    await session.commit()

            await session.commit()

        log.info("synthetic_embeddings_created", count=created)

        try:
            await observer.emit("synthetic_created", "pipeline", "seed_manager", {
                "count": created,
                "perturbation": perturbation,
                "base_count": len(base_embeddings),
            })
        except Exception:
            pass

        return {"created": created}

    async def create_auto_honeypots(self, count: int = 20, platform: str | None = None) -> dict:
        """Pick random face embeddings from already-crawled images and create honeypot test contributors.

        Copies discovered face embeddings into contributor_embeddings so the
        matching pipeline should detect them back with ~1.0 similarity.

        Args:
            count: Number of honeypots to create (max 100).
            platform: Optional platform filter (e.g. 'civitai', 'deviantart').

        Returns:
            Dict with generated count, honeypot_ids, and contributor_ids.
        """
        async with async_session() as session:
            # 1. Query random discovered face embeddings with source info
            result = await session.execute(
                text("""
                    SELECT dfe.id, dfe.embedding::text, dfe.detection_score,
                           di.source_url, di.page_url, di.platform
                    FROM discovered_face_embeddings dfe
                    JOIN discovered_images di ON di.id = dfe.discovered_image_id
                    WHERE di.has_face = true
                      AND (:platform IS NULL OR di.platform = :platform)
                    ORDER BY random()
                    LIMIT :count
                """),
                {"platform": platform, "count": count},
            )
            rows = result.all()

        if not rows:
            log.warning("no_discovered_faces_for_honeypot", platform=platform)
            return {"generated": 0, "honeypot_ids": [], "contributor_ids": []}

        honeypot_ids = []
        contributor_ids = []

        async with async_session() as session:
            for row in rows:
                dfe_id, emb_str, detection_score, source_url, page_url, row_platform = row

                # Parse embedding string → numpy array
                embedding = np.array(
                    [float(x) for x in emb_str.strip("[]").split(",")],
                    dtype=np.float32,
                )

                contributor_id = uuid.uuid4()
                honeypot_email = f"honeypot-auto-{contributor_id}@test.consentedai.com"

                # Create test contributor
                contributor = Contributor(
                    id=contributor_id,
                    full_name=f"Auto Honeypot ({row_platform})",
                    email=honeypot_email,
                    verification_status="approved",
                    subscription_tier="premium",
                    consent_given=True,
                    onboarding_completed=True,
                    is_test_user=True,
                    test_user_type="honeypot",
                )
                session.add(contributor)
                await session.flush()

                # Copy embedding into contributor_embeddings
                embedding_row = ContributorEmbedding(
                    contributor_id=contributor_id,
                    embedding=embedding.tolist(),
                    detection_score=detection_score or 0.99,
                    is_primary=True,
                    embedding_type="single",
                )
                session.add(embedding_row)

                # Create honeypot item
                planted_url = source_url or page_url or ""
                item = TestHoneypotItem(
                    contributor_id=contributor_id,
                    platform=row_platform,
                    planted_url=planted_url,
                    content_type="image",
                    generation_method="auto_embedding_copy",
                    difficulty="easy",
                    expected_similarity_min=0.98,
                    expected_similarity_max=1.0,
                )
                session.add(item)
                await session.flush()

                honeypot_ids.append(str(item.id))
                contributor_ids.append(str(contributor_id))

            await session.commit()

        generated = len(honeypot_ids)
        log.info(
            "auto_honeypots_created",
            count=generated,
            platform=platform,
        )

        try:
            await observer.emit("auto_honeypots_created", "pipeline", "seed_manager", {
                "count": generated,
                "platform": platform,
            })
        except Exception:
            pass

        return {
            "generated": generated,
            "honeypot_ids": honeypot_ids,
            "contributor_ids": contributor_ids,
        }

    async def cleanup_synthetic(self) -> dict:
        """Delete all synthetic test contributors.

        CASCADE handles embeddings, matches, scan_schedule.

        Returns:
            Dict with deleted count.
        """
        async with async_session() as session:
            result = await session.execute(
                text("""
                    DELETE FROM contributors
                    WHERE is_test_user = true AND test_user_type = 'synthetic'
                """)
            )
            deleted = result.rowcount
            await session.commit()

        log.info("synthetic_cleanup", deleted=deleted)
        return {"deleted": deleted}

    async def get_test_stats(self) -> dict:
        """Get comprehensive test user statistics.

        Returns:
            Dict with counts by type, honeypot stats, match counts.
        """
        async with async_session() as session:
            # Counts by type
            r = await session.execute(
                text("""
                    SELECT
                      count(*) FILTER (WHERE test_user_type = 'seeded') AS seeded,
                      count(*) FILTER (WHERE test_user_type = 'honeypot') AS honeypots,
                      count(*) FILTER (WHERE test_user_type = 'synthetic') AS synthetic
                    FROM contributors WHERE is_test_user = true
                """)
            )
            row = r.first()
            counts = {
                "seeded": row[0] if row else 0,
                "honeypots": row[1] if row else 0,
                "synthetic": row[2] if row else 0,
            }

            # Honeypot stats
            r = await session.execute(
                text("""
                    SELECT
                      count(*) AS total,
                      count(*) FILTER (WHERE detected = true) AS detected
                    FROM test_honeypot_items
                """)
            )
            row = r.first()
            hp_total = row[0] if row else 0
            hp_detected = row[1] if row else 0

            # Match counts against test users
            r = await session.execute(
                text("""
                    SELECT count(*) FROM matches m
                    JOIN contributors c ON c.id = m.contributor_id
                    WHERE c.is_test_user = true
                """)
            )
            test_matches = r.scalar_one()

        return {
            "counts": counts,
            "total_test_users": counts["seeded"] + counts["honeypots"] + counts["synthetic"],
            "honeypot": {
                "total_planted": hp_total,
                "total_detected": hp_detected,
                "detection_rate": round(hp_detected / hp_total, 4) if hp_total > 0 else None,
            },
            "test_user_matches": test_matches,
        }


# Module-level singleton
seed_manager = SeedManager()
