"""Extract metadata from media files using ffprobe and EXIF parsing."""

import asyncio
import json
import os

from src.utils.logging import get_logger

log = get_logger("deepfake.metadata")

# Encoders that may indicate AI-generated or manipulated content
_SUSPICIOUS_ENCODERS = {
    "lavf", "libx264rgb", "rawvideo",
}


async def extract_metadata(file_path: str) -> dict:
    """Extract metadata from a media file.

    Runs ffprobe for video/audio metadata and parses EXIF for images.

    Returns:
        Dict with: ffprobe_data, exif_data, duration_seconds, fps, codec,
        resolution_width, resolution_height, anomalies
    """
    result = {
        "ffprobe_data": None,
        "exif_data": None,
        "duration_seconds": None,
        "fps": None,
        "codec": None,
        "resolution_width": None,
        "resolution_height": None,
        "anomalies": [],
    }

    if not os.path.exists(file_path):
        log.warning("metadata_file_not_found", file_path=file_path)
        return result

    # Run ffprobe
    ffprobe_data = await _run_ffprobe(file_path)
    if ffprobe_data:
        result["ffprobe_data"] = ffprobe_data
        _parse_ffprobe(ffprobe_data, result)

    # Parse EXIF for images
    exif_data = _parse_exif(file_path)
    if exif_data:
        result["exif_data"] = exif_data

    # Detect anomalies
    _detect_anomalies(result)

    log.info(
        "metadata_extracted",
        file=file_path,
        duration=result["duration_seconds"],
        codec=result["codec"],
        anomalies=len(result["anomalies"]),
    )

    return result


async def _run_ffprobe(file_path: str) -> dict | None:
    """Run ffprobe and return parsed JSON output."""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        file_path,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode(errors="replace")[-200:]
            log.warning("ffprobe_failed", file=file_path, error=error_msg)
            return None

        return json.loads(stdout.decode())
    except Exception as e:
        log.error("ffprobe_error", file=file_path, error=str(e))
        return None


def _parse_ffprobe(data: dict, result: dict) -> None:
    """Extract key fields from ffprobe output."""
    fmt = data.get("format", {})
    streams = data.get("streams", [])

    # Duration
    duration = fmt.get("duration")
    if duration:
        try:
            result["duration_seconds"] = float(duration)
        except (ValueError, TypeError):
            pass

    # Find video stream
    video_stream = None
    for stream in streams:
        if stream.get("codec_type") == "video":
            video_stream = stream
            break

    if video_stream:
        result["codec"] = video_stream.get("codec_name")
        result["resolution_width"] = video_stream.get("width")
        result["resolution_height"] = video_stream.get("height")

        # FPS from r_frame_rate (e.g. "30/1" or "30000/1001")
        r_frame_rate = video_stream.get("r_frame_rate", "")
        if "/" in r_frame_rate:
            try:
                num, den = r_frame_rate.split("/")
                if int(den) > 0:
                    result["fps"] = round(int(num) / int(den), 2)
            except (ValueError, ZeroDivisionError):
                pass


def _parse_exif(file_path: str) -> dict | None:
    """Parse EXIF data from image files using Pillow."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".tiff", ".webp"):
        return None

    try:
        from PIL import Image
        from PIL.ExifTags import TAGS

        img = Image.open(file_path)
        exif_raw = img.getexif()
        img.close()

        if not exif_raw:
            return None

        exif = {}
        for tag_id, value in exif_raw.items():
            tag_name = TAGS.get(tag_id, str(tag_id))
            # Convert bytes to string for JSON serialization
            if isinstance(value, bytes):
                try:
                    value = value.decode(errors="replace")
                except Exception:
                    value = str(value)
            exif[tag_name] = str(value)

        return exif if exif else None
    except Exception as e:
        log.debug("exif_parse_failed", file=file_path, error=str(e))
        return None


def _detect_anomalies(result: dict) -> None:
    """Flag metadata anomalies that may indicate manipulation."""
    anomalies = result["anomalies"]

    # Missing metadata entirely
    if result["ffprobe_data"] is None and result["exif_data"] is None:
        anomalies.append("no_metadata_found")

    # Check for suspicious encoders
    if result["ffprobe_data"]:
        fmt = result["ffprobe_data"].get("format", {})
        encoder = fmt.get("tags", {}).get("encoder", "").lower()
        for suspicious in _SUSPICIOUS_ENCODERS:
            if suspicious in encoder:
                anomalies.append(f"suspicious_encoder:{encoder}")
                break

    # Stripped EXIF on images
    ext_hint = ""
    if result["ffprobe_data"]:
        for s in result["ffprobe_data"].get("streams", []):
            if s.get("codec_type") == "video" and s.get("codec_name") in ("mjpeg", "png"):
                ext_hint = "image"
    if ext_hint == "image" and result["exif_data"] is None:
        anomalies.append("stripped_exif")

    # Unusual resolution (potential upscale artifact)
    w = result["resolution_width"]
    h = result["resolution_height"]
    if w and h and (w > 7680 or h > 4320):
        anomalies.append("unusually_high_resolution")
