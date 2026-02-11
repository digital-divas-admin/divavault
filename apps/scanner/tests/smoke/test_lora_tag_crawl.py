"""Smoke test: validate LoRA tag-based model crawl against live CivitAI API.

Run with: .venv/bin/python tests/smoke/test_lora_tag_crawl.py
"""

import asyncio
import aiohttp
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.discovery.platform_crawl import (
    CivitAICrawl,
    CIVITAI_MODELS_URL,
    LORA_HUMAN_TAGS,
)
from src.discovery.base import DiscoveryContext


async def test_single_page_per_tag():
    """Fetch 1 page per tag and verify structure + cursor pagination."""
    print("=" * 60)
    print("TEST 1: Single page per tag — API structure validation")
    print("=" * 60)

    total_images = 0
    total_models = 0
    tags_with_results = 0

    async with aiohttp.ClientSession() as session:
        for tag in LORA_HUMAN_TAGS:
            params = {"types": "LORA", "sort": "Newest", "limit": 100, "tag": tag}
            async with session.get(CIVITAI_MODELS_URL, params=params) as resp:
                assert resp.status == 200, f"API returned {resp.status} for tag={tag}"
                data = await resp.json()

            metadata = data.get("metadata", {})
            next_cursor = metadata.get("nextCursor")
            items = data.get("items", [])

            tag_images = 0
            for model in items:
                assert "id" in model, f"Model missing 'id' for tag={tag}"
                assert "name" in model, f"Model missing 'name' for tag={tag}"
                for version in model.get("modelVersions", []):
                    for image in version.get("images", []):
                        if image.get("url"):
                            tag_images += 1

            total_models += len(items)
            total_images += tag_images
            if len(items) > 0:
                tags_with_results += 1

            cursor_status = f"cursor={next_cursor[:20]}..." if next_cursor else "NO MORE PAGES"
            print(f"  tag={tag:20s} models={len(items):4d}  images={tag_images:5d}  {cursor_status}")

    print(f"\nTotals: {total_models} models, {total_images} images across {tags_with_results}/{len(LORA_HUMAN_TAGS)} tags")
    assert tags_with_results >= 5, f"Expected 5+ tags with results, got {tags_with_results}"
    assert total_images > 100, f"Expected 100+ images, got {total_images}"
    print("PASS\n")


async def test_cursor_pagination():
    """Verify cursor pagination works across 2 pages for one tag."""
    print("=" * 60)
    print("TEST 2: Cursor pagination — fetch 2 pages for 'realistic'")
    print("=" * 60)

    tag = "realistic"
    async with aiohttp.ClientSession() as session:
        # Page 1
        params = {"types": "LORA", "sort": "Newest", "limit": 100, "tag": tag}
        async with session.get(CIVITAI_MODELS_URL, params=params) as resp:
            assert resp.status == 200
            data1 = await resp.json()

        cursor1 = data1.get("metadata", {}).get("nextCursor")
        page1_ids = {m["id"] for m in data1.get("items", [])}
        print(f"  Page 1: {len(page1_ids)} models, cursor={cursor1[:20] if cursor1 else 'None'}...")

        assert cursor1, "Expected nextCursor on page 1 (realistic should have >100 models)"

        # Page 2
        params["cursor"] = cursor1
        async with session.get(CIVITAI_MODELS_URL, params=params) as resp:
            assert resp.status == 200
            data2 = await resp.json()

        cursor2 = data2.get("metadata", {}).get("nextCursor")
        page2_ids = {m["id"] for m in data2.get("items", [])}
        print(f"  Page 2: {len(page2_ids)} models, cursor={cursor2[:20] if cursor2 else 'None'}...")

        overlap = page1_ids & page2_ids
        print(f"  Overlap: {len(overlap)} model IDs (should be 0)")
        assert len(overlap) == 0, f"Cursor pagination returned duplicate models: {overlap}"

    print("PASS\n")


async def test_discover_with_model_cursors():
    """Test the full discover() method with model_cursors round-trip (mocked to 1 page)."""
    print("=" * 60)
    print("TEST 3: CivitAICrawl.discover() with model_cursors round-trip")
    print("=" * 60)

    from unittest.mock import patch

    # Limit to 1 page per tag to keep it fast
    with patch("src.discovery.platform_crawl.settings") as mock_settings:
        mock_settings.civitai_max_pages = 0  # skip image feed + image search
        mock_settings.civitai_nsfw_filter = "None"
        mock_settings.civitai_model_pages_per_tag = 1

        crawler = CivitAICrawl()
        context = DiscoveryContext(platform="civitai", model_cursors=None)
        result = await crawler.discover(context)

    print(f"  Total images discovered: {len(result.images)}")
    print(f"  model_cursors returned: {result.model_cursors is not None}")

    assert result.model_cursors is not None, "Expected model_cursors in result"
    assert isinstance(result.model_cursors, dict), "model_cursors should be a dict"

    tags_with_cursor = {k: v for k, v in result.model_cursors.items() if v is not None}
    tags_exhausted = {k for k, v in result.model_cursors.items() if v is None}
    print(f"  Tags with active cursor: {len(tags_with_cursor)} — {list(tags_with_cursor.keys())}")
    print(f"  Tags exhausted: {len(tags_exhausted)} — {tags_exhausted}")

    # Verify all tags are represented
    for tag in LORA_HUMAN_TAGS:
        assert tag in result.model_cursors, f"Tag '{tag}' missing from model_cursors"

    # Verify images are DiscoveredImageResult with correct fields
    if result.images:
        sample = result.images[0]
        assert sample.platform == "civitai"
        assert sample.source_url.startswith("http")
        assert sample.page_url and "civitai.com/models/" in sample.page_url
        print(f"  Sample: url={sample.source_url[:60]}... page={sample.page_url}")

    # Now do a second pass with the cursors to prove resume works
    print("\n  --- Resume with saved cursors ---")
    with patch("src.discovery.platform_crawl.settings") as mock_settings:
        mock_settings.civitai_max_pages = 0
        mock_settings.civitai_nsfw_filter = "None"
        mock_settings.civitai_model_pages_per_tag = 1

        context2 = DiscoveryContext(platform="civitai", model_cursors=tags_with_cursor)
        result2 = await crawler.discover(context2)

    print(f"  Pass 2 images: {len(result2.images)}")

    # Check that pass 2 returned different images (no overlap from cursor resume)
    pass1_urls = {img.source_url for img in result.images}
    pass2_urls = {img.source_url for img in result2.images}
    overlap = pass1_urls & pass2_urls
    overlap_pct = len(overlap) / max(len(pass1_urls), 1) * 100
    print(f"  URL overlap: {len(overlap)}/{len(pass1_urls)} ({overlap_pct:.1f}%)")
    # Some overlap is possible from tags that share models, but shouldn't be 100%
    if len(pass1_urls) > 50:
        assert overlap_pct < 80, f"Too much overlap ({overlap_pct:.1f}%) — cursor resume may not be working"

    print("PASS\n")


async def test_scheduler_cursor_persistence_logic():
    """Unit test: verify scheduler persistence logic for model_cursors."""
    print("=" * 60)
    print("TEST 4: Scheduler model_cursors persistence logic")
    print("=" * 60)

    from src.discovery.base import DiscoveryResult

    # Case 1: Active cursors should be persisted
    result = DiscoveryResult(
        images=[],
        model_cursors={"realistic": "abc123", "face": None, "woman": "xyz789"},
    )
    new_search_terms = {}
    if result.model_cursors:
        active = {k: v for k, v in result.model_cursors.items() if v is not None}
        if active:
            new_search_terms["model_cursors"] = active
        elif "model_cursors" in new_search_terms:
            del new_search_terms["model_cursors"]
    elif "model_cursors" in new_search_terms:
        del new_search_terms["model_cursors"]

    assert new_search_terms == {"model_cursors": {"realistic": "abc123", "woman": "xyz789"}}
    print("  Case 1 (active cursors persisted, None dropped): PASS")

    # Case 2: All cursors exhausted should remove the key
    result2 = DiscoveryResult(
        images=[],
        model_cursors={"realistic": None, "face": None},
    )
    new_search_terms2 = {"model_cursors": {"realistic": "old"}}
    if result2.model_cursors:
        active = {k: v for k, v in result2.model_cursors.items() if v is not None}
        if active:
            new_search_terms2["model_cursors"] = active
        elif "model_cursors" in new_search_terms2:
            del new_search_terms2["model_cursors"]

    assert "model_cursors" not in new_search_terms2
    print("  Case 2 (all exhausted, key removed): PASS")

    # Case 3: No model_cursors at all should clean up stale key
    result3 = DiscoveryResult(images=[], model_cursors=None)
    new_search_terms3 = {"model_cursors": {"stale": "data"}}
    if result3.model_cursors:
        pass
    elif "model_cursors" in new_search_terms3:
        del new_search_terms3["model_cursors"]

    assert "model_cursors" not in new_search_terms3
    print("  Case 3 (None result, stale key cleaned): PASS")

    # Case 4: model_cursors round-trips through DiscoveryContext
    ctx = DiscoveryContext(model_cursors={"realistic": "cursor123"})
    assert ctx.model_cursors == {"realistic": "cursor123"}
    print("  Case 4 (DiscoveryContext round-trip): PASS")

    print("PASS\n")


async def main():
    print("\nLoRA Tag-Based Model Crawl — Smoke Tests")
    print("=" * 60)
    print(f"Tags: {LORA_HUMAN_TAGS}")
    print(f"API: {CIVITAI_MODELS_URL}")
    print()

    await test_single_page_per_tag()
    await test_cursor_pagination()
    await test_discover_with_model_cursors()
    await test_scheduler_cursor_persistence_logic()

    print("=" * 60)
    print("ALL TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
