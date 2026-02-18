"""AI-generated content detection.

Thin wrapper around the active AIDetectionProvider.
Only called for paid tier contributors on non-allowlisted matches
at medium+ confidence.
"""

from src.utils.logging import get_logger

log = get_logger("ai_classifier")


async def classify_ai_generated(image_url: str) -> dict | None:
    """Classify whether an image is AI-generated.

    Args:
        image_url: URL of the image to classify.

    Returns:
        Dict with 'is_ai_generated' (bool), 'score' (float), 'generator' (str|None),
        or None on failure.
    """
    from src.providers import get_ai_detection_provider

    result = await get_ai_detection_provider().classify(image_url)
    if result is None:
        return None
    return result.to_dict()
