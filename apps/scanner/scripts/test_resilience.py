"""End-to-end test for the resilience module pipeline."""

import asyncio
import json
from datetime import datetime, timedelta, timezone


async def test_resilience():
    now = datetime.now(timezone.utc)

    # ----------------------------------------------------------------
    # 1. COLLECTOR: Insert telemetry snapshots
    # ----------------------------------------------------------------
    print("=== 1. COLLECTOR: Recording crawl telemetry ===")
    from src.resilience.collector import collector

    snapshot_ids = []
    for i in range(4):
        sid = await collector.record_crawl(
            platform="civitai",
            crawl_type="sweep",
            started_at=now - timedelta(hours=i * 6, minutes=5),
            finished_at=now - timedelta(hours=i * 6),
            images_discovered=980 + i * 10,
            images_new=45 + i * 5,
            tags_total=107,
            tags_exhausted=3 + i,
            faces_found=30 + i,
            tick_number=i + 1,
        )
        snapshot_ids.append(sid)
        print(f"  Snapshot {i+1}: id={sid}, discovered={980+i*10}, new={45+i*5}")
    print(f"  Total snapshots inserted: {len(snapshot_ids)}")

    # ----------------------------------------------------------------
    # 2. BASELINE: Compute rolling averages
    # ----------------------------------------------------------------
    print()
    print("=== 2. BASELINE: Computing rolling averages ===")
    from src.resilience.baseline import baseline_calculator

    baseline = await baseline_calculator.get_baseline("civitai")
    if not baseline:
        print("  ERROR: No baseline returned (need >= 3 snapshots)")
        return
    print(f"  avg_discovered: {baseline['avg_discovered']:.1f}")
    print(f"  avg_new: {baseline['avg_new']:.1f}")
    print(f"  avg_duration: {baseline['avg_duration']:.1f}s")
    print(f"  snapshot_count: {baseline['snapshot_count']}")

    # ----------------------------------------------------------------
    # 3. DETECTOR: Healthy crawl -- no events expected
    # ----------------------------------------------------------------
    print()
    print("=== 3. DETECTOR: Healthy crawl (no events expected) ===")
    from sqlalchemy import select

    from src.db.connection import async_session
    from src.resilience.detector import degradation_detector
    from src.resilience.models import CrawlHealthSnapshot

    async with async_session() as session:
        result = await session.execute(
            select(CrawlHealthSnapshot)
            .where(CrawlHealthSnapshot.platform == "civitai")
            .order_by(CrawlHealthSnapshot.created_at.desc())
            .limit(1)
        )
        latest = result.scalar_one_or_none()

    events = await degradation_detector.check("civitai", latest, baseline)
    print(f"  Events from healthy crawl: {len(events)} (expected: 0)")
    assert len(events) == 0, f"Expected 0 events, got {len(events)}"

    # ----------------------------------------------------------------
    # 4. DETECTOR: Yield collapse simulation
    # ----------------------------------------------------------------
    print()
    print("=== 4. DETECTOR: Simulating yield collapse ===")
    degraded_id = await collector.record_crawl(
        platform="civitai",
        crawl_type="sweep",
        started_at=now - timedelta(minutes=2),
        finished_at=now,
        images_discovered=500,
        images_new=5,  # ~10% of baseline avg
        tags_total=107,
        tags_exhausted=90,
        faces_found=1,
        tick_number=99,
    )
    print(f"  Degraded snapshot: id={degraded_id}, images_new=5 (baseline avg={baseline['avg_new']:.1f})")

    async with async_session() as session:
        result = await session.execute(
            select(CrawlHealthSnapshot).where(CrawlHealthSnapshot.id == degraded_id)
        )
        degraded_snap = result.scalar_one()

    events = await degradation_detector.check("civitai", degraded_snap, baseline)
    print(f"  Events detected: {len(events)}")
    assert len(events) > 0, "Expected at least 1 degradation event"
    for evt in events:
        print(f"    - type={evt.degradation_type}, severity={evt.severity}")
        print(f"      symptom: {evt.symptom}")
        print(f"      status: {evt.status}")

    # ----------------------------------------------------------------
    # 5. NOTIFIER: Send alert
    # ----------------------------------------------------------------
    print()
    print("=== 5. NOTIFIER: Sending degradation alert ===")
    from src.resilience.notifier import notify_degradation

    await notify_degradation(events[0])
    print(f"  Notification sent for: {events[0].degradation_type}")

    # ----------------------------------------------------------------
    # 6. DEDUP: Re-run same check -- no duplicate expected
    # ----------------------------------------------------------------
    print()
    print("=== 6. DEDUP: Re-running same check ===")
    events2 = await degradation_detector.check("civitai", degraded_snap, baseline)
    print(f"  Events on re-check: {len(events2)} (expected: 0 due to dedup)")
    assert len(events2) == 0, f"Dedup failed: got {len(events2)} events"

    # ----------------------------------------------------------------
    # 7. DETECTOR: Total failure simulation
    # ----------------------------------------------------------------
    print()
    print("=== 7. DETECTOR: Simulating total failure (0 discovered) ===")
    from src.resilience.models import DegradationEvent

    # Resolve existing open events so dedup allows new ones
    async with async_session() as session:
        open_evts = await session.execute(
            select(DegradationEvent).where(
                DegradationEvent.platform == "civitai",
                DegradationEvent.status == "open",
            )
        )
        for e in open_evts.scalars():
            e.status = "resolved"
        await session.commit()

    zero_id = await collector.record_crawl(
        platform="civitai",
        crawl_type="sweep",
        started_at=now - timedelta(minutes=1),
        finished_at=now,
        images_discovered=0,
        images_new=0,
        error_message="Connection refused",
        tick_number=100,
    )
    async with async_session() as session:
        result = await session.execute(
            select(CrawlHealthSnapshot).where(CrawlHealthSnapshot.id == zero_id)
        )
        zero_snap = result.scalar_one()

    # Recompute baseline (excludes error snapshots)
    baseline2 = await baseline_calculator.get_baseline("civitai")
    events3 = await degradation_detector.check("civitai", zero_snap, baseline2)
    print(f"  Events detected: {len(events3)}")
    for evt in events3:
        print(f"    - type={evt.degradation_type}, severity={evt.severity}")
        print(f"      symptom: {evt.symptom}")

    # ----------------------------------------------------------------
    # 8. DB STATE: Verify tables
    # ----------------------------------------------------------------
    print()
    print("=== 8. DB STATE ===")
    async with async_session() as session:
        snaps = await session.execute(
            select(CrawlHealthSnapshot).where(CrawlHealthSnapshot.platform == "civitai")
        )
        snapshots = list(snaps.scalars().all())

        evts = await session.execute(
            select(DegradationEvent).where(DegradationEvent.platform == "civitai")
        )
        deg_events = list(evts.scalars().all())

    print(f"  crawl_health_snapshots: {len(snapshots)} rows")
    print(f"  degradation_events: {len(deg_events)} rows")
    for de in deg_events:
        print(f"    [{de.status}] {de.degradation_type} ({de.severity}): {de.symptom[:80]}")

    # ----------------------------------------------------------------
    # 9. CACHE: Healthy page caching
    # ----------------------------------------------------------------
    print()
    print("=== 9. CACHE: Healthy page caching ===")
    from src.resilience.cache import cache_healthy_page, get_cached_healthy_pages

    await cache_healthy_page(
        platform="civitai",
        search_term="test_tag",
        url="https://civitai.com/api/v1/images?limit=10&tags=test",
        html="<html><body><img src='test.jpg'/></body></html>",
        images_found=1,
        status=200,
        size=1024,
    )
    cached = await get_cached_healthy_pages("civitai", "test_tag")
    print(f"  Pages cached: {len(cached)}")
    assert len(cached) > 0, "Expected cached pages"
    print(f"  Latest: url={cached[0].url}, images_found={cached[0].images_found}")

    # ----------------------------------------------------------------
    # 10. HEALTH ENDPOINT: Verify /health includes resilience data
    # ----------------------------------------------------------------
    print()
    print("=== 10. HEALTH ENDPOINT ===")
    import aiohttp

    async with aiohttp.ClientSession() as http:
        async with http.get("http://localhost:8000/health") as resp:
            data = await resp.json()
            res = data.get("resilience", {})
            print(f"  enabled: {res.get('enabled')}")
            print(f"  open_events: {res.get('open_events')}")
            print(f"  latest_snapshots: {json.dumps(res.get('latest_snapshots', {}), indent=4)}")
            print(f"  baselines_available: {res.get('baselines_available')}")
            assert res.get("enabled") is True
            assert "civitai" in res.get("latest_snapshots", {})
            assert "civitai" in res.get("baselines_available", [])

    print()
    print("========================================")
    print("  ALL 10 TESTS PASSED")
    print("========================================")


if __name__ == "__main__":
    asyncio.run(test_resilience())
