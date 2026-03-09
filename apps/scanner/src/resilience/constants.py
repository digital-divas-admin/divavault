"""Shared constants and utilities for the resilience module."""

import asyncio
import os
from pathlib import Path

from src.utils.logging import get_logger

log = get_logger("resilience.cli")

# Scanner root directory (apps/scanner/)
SCANNER_ROOT = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Map platform → crawler source file (relative to SCANNER_ROOT)
CRAWLER_FILES = {
    "civitai": "src/discovery/platform_crawl.py",
    "deviantart": "src/discovery/deviantart_crawl.py",
    "fourchan": "src/discovery/fourchan_crawl.py",
}

# Map platform → diagnostic URL for snapshot capture
PLATFORM_DIAGNOSTIC_URLS = {
    "civitai": "https://civitai.com/api/v1/images?limit=1",
    "deviantart": "https://www.deviantart.com/tag/aiart",
    "fourchan": "https://a.4cdn.org/s/catalog.json",
}

# Platforms monitored by the resilience module
MONITORED_PLATFORMS = list(CRAWLER_FILES.keys())


async def run_claude_cli(prompt: str, timeout_seconds: int) -> str | None:
    """Run Claude CLI with the given prompt. Returns response text or None.

    Handles TimeoutError, FileNotFoundError, and generic exceptions.
    Never raises — logs errors internally.
    """
    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "-p", prompt, "--output-format", "text",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(), timeout=timeout_seconds
        )
        if proc.returncode != 0:
            stderr_str = stderr_bytes.decode(errors="replace")
            log.error("claude_cli_error", returncode=proc.returncode, stderr=stderr_str[:500])
            return None

        return stdout_bytes.decode(errors="replace").strip()
    except asyncio.TimeoutError:
        log.error("claude_cli_timeout", timeout=timeout_seconds)
        if proc:
            proc.kill()
            await proc.wait()
        return None
    except FileNotFoundError:
        log.error("claude_cli_not_found")
        return None
    except Exception as e:
        log.error("claude_cli_error", error=str(e))
        return None
