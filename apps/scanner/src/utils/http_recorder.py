"""HTTP recording and replay for deterministic crawler testing.

RecordingSession wraps a real aiohttp.ClientSession, intercepts .get(),
saves response body + metadata to disk, and returns the real response.

ReplaySession reads from a cache directory and returns saved responses
in request sequence order. No network access.
"""

import json
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any

import aiohttp

from src.utils.logging import get_logger

log = get_logger("http_recorder")


@dataclass
class CachedResponse:
    """Minimal response interface matching what crawlers use from aiohttp.ClientResponse."""
    status: int
    _body: bytes
    _headers: dict
    content_type: str | None = None

    async def read(self) -> bytes:
        return self._body

    async def json(self) -> Any:
        return json.loads(self._body)

    async def text(self) -> str:
        return self._body.decode("utf-8", errors="replace")

    @property
    def headers(self) -> dict:
        return self._headers

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class RecordingSession:
    """Wraps a real aiohttp.ClientSession, recording responses to disk.

    Usage:
        real_session = aiohttp.ClientSession(...)
        recorder = RecordingSession(real_session, Path("cache/reddit/2026-03-11"))
        # Use recorder.get() instead of session.get()
        async with recorder.get(url, params=...) as resp:
            data = await resp.json()
    """

    def __init__(self, inner: aiohttp.ClientSession, cache_dir: Path) -> None:
        self._inner = inner
        self._cache_dir = cache_dir
        self._responses_dir = cache_dir / "responses"
        self._responses_dir.mkdir(parents=True, exist_ok=True)
        self._seq = 0
        self._log_path = cache_dir / "request_log.jsonl"

        # Write manifest
        manifest = {
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "type": "recording",
        }
        (cache_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    def get(self, url: str, **kwargs) -> "_RecordingContextManager":
        return _RecordingContextManager(self, url, kwargs)

    async def _record_get(self, url: str, kwargs: dict) -> aiohttp.ClientResponse:
        """Perform real GET, save response, return real response object."""
        self._seq += 1
        seq = self._seq

        resp = await self._inner.get(url, **kwargs)
        body = await resp.read()

        # Save response body
        filename = f"{seq:04d}.bin"
        (self._responses_dir / filename).write_bytes(body)

        # Log request metadata
        entry = {
            "seq": seq,
            "url": str(url),
            "params": kwargs.get("params"),
            "status": resp.status,
            "content_type": resp.content_type,
            "file": filename,
            "headers": dict(resp.headers) if resp.headers else {},
        }
        with open(self._log_path, "a") as f:
            f.write(json.dumps(entry) + "\n")

        log.debug("http_recorded", seq=seq, url=str(url)[:120], status=resp.status)
        return resp

    # Passthrough properties for compatibility
    @property
    def headers(self):
        return self._inner._default_headers if hasattr(self._inner, '_default_headers') else {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        # Don't close the inner session - caller manages it
        pass


class _RecordingContextManager:
    """Context manager that records the response."""
    def __init__(self, recorder: RecordingSession, url: str, kwargs: dict):
        self._recorder = recorder
        self._url = url
        self._kwargs = kwargs
        self._resp = None

    async def __aenter__(self) -> aiohttp.ClientResponse:
        self._resp = await self._recorder._record_get(self._url, self._kwargs)
        return self._resp

    async def __aexit__(self, *args):
        if self._resp is not None:
            self._resp.release()


class ReplaySession:
    """Reads from cache directory, returns saved responses matched by URL.

    Matching strategy: URL-based with per-URL sequence tracking. When multiple
    responses were recorded for the same URL, they're returned in capture order.
    This handles concurrent crawlers correctly — requests can arrive in any order
    during replay and still get the right response.

    Usage:
        replayer = ReplaySession(Path("cache/reddit/2026-03-11"))
        async with replayer.get(url) as resp:
            data = await resp.json()
    """

    def __init__(self, cache_dir: Path) -> None:
        self._cache_dir = cache_dir
        self._responses_dir = cache_dir / "responses"
        self._request_count = 0

        # Load request log and index by URL
        self._url_index: dict[str, list[dict]] = {}  # url -> [entries in capture order]
        self._url_cursors: dict[str, int] = {}  # url -> next index to serve
        log_path = cache_dir / "request_log.jsonl"
        total = 0
        if log_path.exists():
            for line in log_path.read_text().strip().split("\n"):
                if line:
                    entry = json.loads(line)
                    url = entry.get("url", "")
                    self._url_index.setdefault(url, []).append(entry)
                    total += 1

        log.info(
            "replay_session_loaded",
            cache_dir=str(cache_dir),
            total_responses=total,
            unique_urls=len(self._url_index),
        )

    def get(self, url: str, **kwargs) -> "_ReplayContextManager":
        return _ReplayContextManager(self, url)

    def _next_response(self, url: str) -> CachedResponse:
        """Return next cached response for this specific URL."""
        self._request_count += 1

        entries = self._url_index.get(url)
        if not entries:
            log.warning(
                "replay_url_not_found",
                request_num=self._request_count,
                url=url[:120],
            )
            return CachedResponse(
                status=404,
                _body=b"{}",
                _headers={},
                content_type="application/json",
            )

        cursor = self._url_cursors.get(url, 0)
        if cursor >= len(entries):
            log.warning(
                "replay_url_exhausted",
                request_num=self._request_count,
                url=url[:120],
                served=cursor,
            )
            return CachedResponse(
                status=404,
                _body=b"{}",
                _headers={},
                content_type="application/json",
            )

        entry = entries[cursor]
        self._url_cursors[url] = cursor + 1

        filename = entry["file"]
        body_path = self._responses_dir / filename

        if not body_path.exists():
            log.warning("replay_file_missing", seq=entry.get("seq"), file=filename)
            return CachedResponse(
                status=500,
                _body=b"{}",
                _headers={},
                content_type="application/json",
            )

        body = body_path.read_bytes()
        headers = entry.get("headers", {})
        content_type = entry.get("content_type")

        log.debug(
            "http_replayed",
            request_num=self._request_count,
            url=url[:120],
            status=entry["status"],
        )

        return CachedResponse(
            status=entry["status"],
            _body=body,
            _headers=headers,
            content_type=content_type,
        )

    # Passthrough for compatibility
    @property
    def headers(self):
        return {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class _ReplayContextManager:
    """Context manager for replayed responses."""
    def __init__(self, replayer: ReplaySession, url: str):
        self._replayer = replayer
        self._url = url

    async def __aenter__(self) -> CachedResponse:
        return self._replayer._next_response(self._url)

    async def __aexit__(self, *args):
        pass
