"""Evidence capture: screenshots of source pages using Playwright."""

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from src.config import settings
from src.utils.logging import get_logger

log = get_logger("evidence_capture")

# Lazy-loaded browser
_browser = None
_playwright = None


async def _get_browser():
    """Get or create a Playwright browser instance."""
    global _browser, _playwright
    if _browser is None:
        from playwright.async_api import async_playwright

        _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(headless=True)
        log.info("playwright_browser_started")
    return _browser


async def capture_screenshot(page_url: str) -> dict | None:
    """Take a full-page screenshot of a URL.

    Returns:
        Dict with 'path' (Path), 'page_title' (str), 'timestamp' (str),
        or None on failure.
    """
    try:
        browser = await _get_browser()
        page = await browser.new_page()

        try:
            await page.goto(page_url, timeout=15000, wait_until="domcontentloaded")

            title = await page.title()
            timestamp = datetime.now(timezone.utc).isoformat()

            # Save screenshot to temp dir
            temp_dir = Path(settings.temp_dir)
            temp_dir.mkdir(parents=True, exist_ok=True)
            screenshot_path = temp_dir / f"evidence_{uuid4().hex}.png"

            await page.screenshot(path=str(screenshot_path), full_page=True)

            log.info(
                "screenshot_captured",
                url=page_url,
                title=title[:100] if title else None,
                size=screenshot_path.stat().st_size,
            )

            return {
                "path": screenshot_path,
                "page_title": title,
                "timestamp": timestamp,
            }
        finally:
            await page.close()

    except Exception as e:
        log.error("screenshot_capture_error", url=page_url, error=str(e))
        return None


async def shutdown_browser():
    """Close the Playwright browser on shutdown."""
    global _browser, _playwright
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None
