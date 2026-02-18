"""Hive Moderation AI detection provider."""

import aiohttp

from src.config import settings
from src.providers.base import AIClassification, AIDetectionProvider
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import CircuitOpenError, retry_async, with_circuit_breaker

log = get_logger("provider.hive")

HIVE_API_URL = "https://api.thehive.ai/api/v2/task/sync"


class HiveAIDetection(AIDetectionProvider):
    """AI-generated image classification via Hive Moderation API."""

    async def classify(self, image_url: str) -> AIClassification | None:
        if not settings.hive_api_key:
            log.warning("hive_api_key_not_configured")
            return None

        try:
            return await self._call_hive(image_url)
        except CircuitOpenError:
            log.warning("hive_circuit_open")
            return None
        except Exception as e:
            log.error("hive_classification_error", error=str(e))
            return None

    @staticmethod
    @with_circuit_breaker("hive")
    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _call_hive(image_url: str) -> AIClassification | None:
        limiter = get_limiter("hive")
        await limiter.acquire()

        headers = {
            "Authorization": f"Token {settings.hive_api_key}",
            "Accept": "application/json",
        }

        data = aiohttp.FormData()
        data.add_field("url", image_url)

        async with aiohttp.ClientSession() as session:
            async with session.post(
                HIVE_API_URL, headers=headers, data=data
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    log.warning("hive_api_error", status=resp.status, body=body[:500])
                    return None

                result = await resp.json()

        return _parse_hive_response(result)


def _parse_hive_response(result: dict) -> AIClassification | None:
    """Parse Hive API response into AIClassification."""
    try:
        status = result.get("status", [])
        if not status:
            return None

        output = status[0].get("response", {}).get("output", [])
        if not output:
            return None

        classes = output[0].get("classes", [])

        ai_score = 0.0
        generator = None

        for cls in classes:
            class_name = cls.get("class", "").lower()
            score = cls.get("score", 0.0)

            if "ai_generated" in class_name or "artificial" in class_name:
                ai_score = max(ai_score, score)

            generators = {
                "stable_diffusion": "stable_diffusion",
                "midjourney": "midjourney",
                "dall_e": "dall_e",
                "dalle": "dall_e",
                "flux": "flux",
            }
            for key, gen_name in generators.items():
                if key in class_name and score > 0.5:
                    generator = gen_name

        return AIClassification(
            is_ai_generated=ai_score > 0.5,
            score=ai_score,
            generator=generator,
        )
    except (KeyError, IndexError, TypeError) as e:
        log.error("hive_parse_error", error=str(e))
        return None
