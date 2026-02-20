"""Reddit scout source — monitor AI subreddits for platform URLs."""

import logging
import re
from urllib.parse import urlparse

import aiohttp

from src.scout.base import BaseScoutSource, ScoutCandidate, ScoutSourceResult
from src.utils.rate_limiter import get_limiter

logger = logging.getLogger(__name__)

SUBREDDITS = [
    "StableDiffusion",
    "AIArt",
    "sdnsfw",
    "comfyui",
    "LocalLLaMA",
]

# Domains to skip
SKIP_DOMAINS = {
    "reddit.com", "i.redd.it", "v.redd.it", "imgur.com", "gfycat.com",
    "youtube.com", "youtu.be", "twitter.com", "x.com", "github.com",
    "huggingface.co", "civitai.com", "deviantart.com",
    "google.com", "wikipedia.org", "discord.com", "discord.gg",
    "instagram.com", "facebook.com", "tiktok.com",
}

URL_PATTERN = re.compile(r'https?://[^\s\)"<>\]]+')


class RedditSource(BaseScoutSource):
    """Discover AI platforms by monitoring relevant subreddits."""

    def get_source_name(self) -> str:
        return "reddit"

    def get_cost_tier(self) -> str:
        return "free"

    async def discover(self, keywords: list[dict]) -> ScoutSourceResult:
        candidates: list[ScoutCandidate] = []
        errors: list[str] = []
        seen_domains: set[str] = set()
        limiter = get_limiter("reddit")

        async with aiohttp.ClientSession(
            headers={"User-Agent": "MadeOfUs-Scout/1.0"}
        ) as session:
            for sub in SUBREDDITS:
                try:
                    await limiter.acquire()
                    url = f"https://www.reddit.com/r/{sub}/hot.json?limit=50"
                    async with session.get(
                        url, timeout=aiohttp.ClientTimeout(total=15)
                    ) as resp:
                        if resp.status != 200:
                            errors.append(f"Reddit r/{sub} returned {resp.status}")
                            continue

                        data = await resp.json()
                        posts = data.get("data", {}).get("children", [])

                        for post in posts:
                            post_data = post.get("data", {})
                            # Extract URLs from selftext and url fields
                            text_sources = [
                                post_data.get("selftext", ""),
                                post_data.get("url", ""),
                            ]
                            all_text = " ".join(text_sources)
                            urls = URL_PATTERN.findall(all_text)

                            for found_url in urls:
                                try:
                                    parsed = urlparse(found_url)
                                    domain = parsed.netloc.lower().removeprefix("www.")
                                    if (
                                        domain
                                        and domain not in seen_domains
                                        and domain not in SKIP_DOMAINS
                                        and "." in domain
                                    ):
                                        seen_domains.add(domain)
                                        candidates.append(
                                            ScoutCandidate(
                                                domain=domain,
                                                url=found_url,
                                                source_query=f"r/{sub}",
                                                source_metadata={
                                                    "post_title": post_data.get("title", "")[:200],
                                                    "subreddit": sub,
                                                },
                                            )
                                        )
                                except Exception:
                                    continue
                except Exception as e:
                    errors.append(f"Reddit r/{sub} failed: {str(e)[:200]}")

        logger.info(f"Reddit: found {len(candidates)} candidate domains")
        return ScoutSourceResult(
            candidates=candidates,
            queries_used=len(SUBREDDITS),
            errors=errors,
        )
