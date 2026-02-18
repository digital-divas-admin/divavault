"""Crawl Scheduler: analyzes upload patterns and recommends crawl timing changes.

Schedule: weekly (every 168 hours)
Minimum signals: 200 crawl_completed signals (~14 crawl cycles per platform)
Model: histogram analysis (numpy), no ML model training
"""

from collections import defaultdict
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select, text

from src.db.connection import async_session
from src.db.models import DiscoveredImage, MLFeedbackSignal, PlatformCrawlSchedule
from src.intelligence.analyzers.base import BaseAnalyzer
from src.utils.logging import get_logger

log = get_logger("crawl_scheduler")

# If current crawl timing misses peak window by more than this many hours, recommend shift
PEAK_MISS_THRESHOLD_HOURS = 4

# If content velocity changed by more than this fraction, recommend interval change
VELOCITY_CHANGE_THRESHOLD = 0.30

# Minimum images to analyze timing patterns
MIN_IMAGES_FOR_ANALYSIS = 50


class CrawlScheduler(BaseAnalyzer):
    """Analyzes content upload patterns and recommends crawl schedule changes."""

    def get_name(self) -> str:
        return "Crawl Scheduler"

    def get_schedule_hours(self) -> float:
        return 168.0  # Weekly

    def get_minimum_signals(self) -> int:
        return 200

    async def analyze(self) -> list[dict]:
        # 1. Load platform crawl schedules
        schedules = await self._load_schedules()
        if not schedules:
            log.info("crawl_scheduler_skip", reason="no_schedules")
            return []

        recommendations = []

        for schedule in schedules:
            platform = schedule.platform

            # 2. Load discovered_at timestamps for this platform
            timestamps = await self._load_discovery_timestamps(platform)
            if len(timestamps) < MIN_IMAGES_FOR_ANALYSIS:
                continue

            # 3. Analyze upload patterns
            hour_hist, dow_hist = self._compute_histograms(timestamps)
            peak_hour = int(np.argmax(hour_hist))
            peak_dow = int(np.argmax(dow_hist))

            # 4. Check timing recommendation
            timing_rec = self._check_timing(schedule, peak_hour, hour_hist)
            if timing_rec:
                recommendations.append(timing_rec)

            # 5. Check frequency recommendation
            frequency_rec = await self._check_frequency(schedule, platform, timestamps)
            if frequency_rec:
                recommendations.append(frequency_rec)

        log.info("crawl_scheduler_complete", recommendations=len(recommendations))
        return recommendations

    async def _load_schedules(self) -> list[PlatformCrawlSchedule]:
        """Load all enabled platform crawl schedules."""
        async with async_session() as session:
            result = await session.execute(
                select(PlatformCrawlSchedule)
                .where(PlatformCrawlSchedule.enabled == True)  # noqa: E712
            )
            return list(result.scalars().all())

    async def _load_discovery_timestamps(self, platform: str) -> list[datetime]:
        """Load discovered_at timestamps for a platform."""
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT discovered_at
                    FROM discovered_images
                    WHERE platform = :platform
                      AND discovered_at IS NOT NULL
                    ORDER BY discovered_at DESC
                    LIMIT 50000
                """),
                {"platform": platform},
            )
            rows = result.fetchall()
        return [row[0] for row in rows if row[0] is not None]

    def _compute_histograms(self, timestamps: list[datetime]) -> tuple[np.ndarray, np.ndarray]:
        """Compute hour-of-day and day-of-week histograms."""
        hours = np.array([ts.hour for ts in timestamps])
        dows = np.array([ts.weekday() for ts in timestamps])

        hour_hist = np.bincount(hours, minlength=24).astype(float)
        dow_hist = np.bincount(dows, minlength=7).astype(float)

        # Normalize to fractions
        hour_total = hour_hist.sum()
        dow_total = dow_hist.sum()
        if hour_total > 0:
            hour_hist /= hour_total
        if dow_total > 0:
            dow_hist /= dow_total

        return hour_hist, dow_hist

    def _check_timing(
        self,
        schedule: PlatformCrawlSchedule,
        peak_hour: int,
        hour_hist: np.ndarray,
    ) -> dict | None:
        """Check if current crawl timing misses peak content windows."""
        # Determine the usual crawl hour from last_crawl_at
        if not schedule.last_crawl_at:
            return None

        crawl_hour = schedule.last_crawl_at.hour
        interval = schedule.crawl_interval_hours

        # Calculate hours between crawl time and peak
        hour_diff = abs(peak_hour - crawl_hour)
        if hour_diff > 12:
            hour_diff = 24 - hour_diff

        if hour_diff <= PEAK_MISS_THRESHOLD_HOURS:
            return None

        # Peak window: 3 hours around peak
        peak_window = [(peak_hour + i) % 24 for i in range(-1, 2)]
        peak_coverage = sum(hour_hist[h] for h in peak_window)

        return {
            "rec_type": "crawl_schedule_change",
            "target_platform": schedule.platform,
            "target_entity": "crawl_timing",
            "current_value": {
                "crawl_hour": crawl_hour,
                "crawl_interval_hours": interval,
            },
            "proposed_value": {
                "crawl_interval_hours": interval,
                "suggested_crawl_hour": peak_hour,
            },
            "reasoning": (
                f"Content on {schedule.platform} peaks at hour {peak_hour}:00 UTC "
                f"({peak_coverage:.0%} of content in peak window), but crawls typically run at "
                f"hour {crawl_hour}:00 UTC ({hour_diff}h gap). Shifting crawl timing to the "
                f"peak window would catch new content sooner."
            ),
            "expected_impact": f"Reduce content discovery latency by ~{hour_diff}h",
            "confidence": min(0.8, peak_coverage * 2),
            "risk_level": "low",
            "supporting_data": {
                "platform": schedule.platform,
                "peak_hour": peak_hour,
                "current_crawl_hour": crawl_hour,
                "hour_gap": hour_diff,
                "peak_window_coverage": round(peak_coverage, 4),
                "hour_distribution": [round(float(h), 4) for h in hour_hist],
            },
        }

    async def _check_frequency(
        self,
        schedule: PlatformCrawlSchedule,
        platform: str,
        timestamps: list[datetime],
    ) -> dict | None:
        """Check if content velocity warrants an interval change."""
        if len(timestamps) < 100:
            return None

        # Split timestamps into two halves (recent vs older)
        sorted_ts = sorted(timestamps, reverse=True)
        midpoint = len(sorted_ts) // 2
        recent = sorted_ts[:midpoint]
        older = sorted_ts[midpoint:]

        if not recent or not older:
            return None

        # Compute daily velocity for each period
        recent_span = (recent[0] - recent[-1]).total_seconds() / 86400
        older_span = (older[0] - older[-1]).total_seconds() / 86400

        if recent_span < 1 or older_span < 1:
            return None

        recent_velocity = len(recent) / recent_span
        older_velocity = len(older) / older_span

        if older_velocity == 0:
            return None

        velocity_change = (recent_velocity - older_velocity) / older_velocity

        if abs(velocity_change) < VELOCITY_CHANGE_THRESHOLD:
            return None

        current_interval = schedule.crawl_interval_hours

        # Recommend shorter interval if velocity increased, longer if decreased
        if velocity_change > 0:
            # More content → crawl more frequently
            proposed_interval = max(6, int(current_interval * 0.75))
        else:
            # Less content → crawl less frequently
            proposed_interval = min(168, int(current_interval * 1.25))

        if proposed_interval == current_interval:
            return None

        direction = "increased" if velocity_change > 0 else "decreased"

        return {
            "rec_type": "crawl_schedule_change",
            "target_platform": platform,
            "target_entity": "crawl_interval",
            "current_value": {"crawl_interval_hours": current_interval},
            "proposed_value": {"crawl_interval_hours": proposed_interval},
            "reasoning": (
                f"Content velocity on {platform} has {direction} by {abs(velocity_change):.0%} "
                f"(recent: {recent_velocity:.1f} images/day vs older: {older_velocity:.1f} images/day). "
                f"Adjusting crawl interval from {current_interval}h to {proposed_interval}h."
            ),
            "expected_impact": f"Better resource allocation; velocity change {velocity_change:+.0%}",
            "confidence": min(0.75, abs(velocity_change)),
            "risk_level": "low",
            "supporting_data": {
                "platform": platform,
                "recent_velocity": round(recent_velocity, 2),
                "older_velocity": round(older_velocity, 2),
                "velocity_change": round(velocity_change, 4),
                "current_interval_hours": current_interval,
                "proposed_interval_hours": proposed_interval,
            },
        }
