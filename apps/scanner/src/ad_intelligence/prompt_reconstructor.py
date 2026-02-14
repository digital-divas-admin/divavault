"""Claude-based face description for stock image search term generation."""

import base64
import json

from src.config import settings
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import retry_async, with_circuit_breaker

log = get_logger("prompt_reconstructor")

SYSTEM_PROMPT = """You are analyzing a face extracted from an advertisement image. Your task is to describe the person's appearance for use as search terms on stock photography platforms.

Return ONLY valid JSON with this structure:
{
  "description": "A concise 1-2 sentence description of the person's appearance",
  "keywords": ["keyword1", "keyword2", ...],
  "demographics": {
    "estimated_age_range": "20-30",
    "gender_presentation": "female",
    "ethnicity_presentation": "East Asian",
    "hair_color": "black",
    "hair_style": "long straight",
    "distinguishing_features": ["glasses", "smile"]
  }
}

Guidelines:
- Keywords should be useful stock photo search terms (e.g., "young professional woman", "business portrait", "smiling asian woman")
- Generate 5-10 diverse keywords combining appearance traits
- Be objective and respectful in descriptions
- Focus on visual attributes useful for finding stock photo matches
- Do NOT include any text outside the JSON object"""

DEFAULT_MODEL = "claude-haiku-4-5-20251001"


@with_circuit_breaker("anthropic")
@retry_async(max_attempts=2, min_wait=1.0, max_wait=15.0)
async def describe_face(
    image_bytes: bytes,
    model: str | None = None,
) -> dict | None:
    """Describe a face image using Claude vision for stock photo search.

    Args:
        image_bytes: Raw image bytes (JPEG/PNG).
        model: Claude model ID. Defaults to Haiku 4.5.

    Returns:
        Dict with 'description', 'keywords', 'demographics', or None on failure.
    """
    if not settings.anthropic_api_key:
        log.warning("anthropic_api_key_not_configured")
        return None

    limiter = get_limiter("anthropic")
    await limiter.acquire()

    model = model or DEFAULT_MODEL
    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

        message = await client.messages.create(
            model=model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64_image,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Describe this person's appearance for stock photo searching.",
                        },
                    ],
                }
            ],
        )

        # Parse response
        response_text = message.content[0].text.strip()

        # Handle markdown code blocks
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            # Remove first and last lines (``` markers)
            lines = [l for l in lines if not l.strip().startswith("```")]
            response_text = "\n".join(lines)

        result = json.loads(response_text)

        # Validate required fields
        if "description" not in result or "keywords" not in result:
            log.warning("incomplete_description_response", keys=list(result.keys()))
            return None

        log.info(
            "face_described",
            keywords_count=len(result.get("keywords", [])),
            model=model,
        )

        return {
            "description": result["description"],
            "keywords": result["keywords"],
            "demographics": result.get("demographics"),
        }

    except json.JSONDecodeError as e:
        log.warning("description_json_parse_error", error=str(e))
        return None
    except Exception as e:
        log.error("describe_face_error", error=str(e))
        raise
