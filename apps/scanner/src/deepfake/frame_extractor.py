"""Extract keyframes from videos using ffmpeg scene change detection."""

import asyncio
import os
from pathlib import Path

from src.utils.logging import get_logger

log = get_logger("deepfake.frame_extractor")


async def extract_keyframes(
    video_path: str,
    output_dir: str,
    max_frames: int = 50,
) -> list[dict]:
    """Extract keyframes from a video using ffmpeg.

    Uses scene change detection first, falls back to uniform sampling
    if too few frames are detected.

    Args:
        video_path: Path to the video file.
        output_dir: Directory to write extracted frames.
        max_frames: Maximum number of frames to extract.

    Returns:
        List of dicts with: frame_number, timestamp_seconds, file_path, thumbnail_path
    """
    os.makedirs(output_dir, exist_ok=True)

    # Get video duration first
    duration = await _get_duration(video_path)
    if duration is None or duration <= 0:
        log.warning("cannot_get_duration", video_path=video_path)
        return []

    # Try scene change detection first
    frames = await _extract_scene_changes(video_path, output_dir, max_frames)

    # Fall back to uniform sampling if scene detection yields too few frames
    min_expected = min(5, max_frames)
    if len(frames) < min_expected:
        log.info(
            "scene_detection_insufficient",
            scene_frames=len(frames),
            min_expected=min_expected,
            falling_back_to="uniform",
        )
        frames = await _extract_uniform(video_path, output_dir, max_frames, duration)

    # Generate thumbnails for each frame
    for frame in frames:
        thumb_path = await _generate_thumbnail(frame["file_path"], output_dir)
        frame["thumbnail_path"] = thumb_path

    log.info("keyframes_extracted", count=len(frames), video=video_path)
    return frames


async def _get_duration(video_path: str) -> float | None:
    """Get video duration in seconds using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        video_path,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()

        if proc.returncode != 0:
            return None

        import json
        data = json.loads(stdout.decode())
        return float(data.get("format", {}).get("duration", 0))
    except Exception as e:
        log.error("ffprobe_duration_error", error=str(e))
        return None


async def _extract_scene_changes(
    video_path: str,
    output_dir: str,
    max_frames: int,
) -> list[dict]:
    """Extract frames at scene changes using ffmpeg select filter."""
    output_pattern = os.path.join(output_dir, "scene_%04d.jpg")

    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"select='gt(scene,0.3)',setpts=N/FRAME_RATE/TB",
        "-frames:v", str(max_frames),
        "-vsync", "vfr",
        "-q:v", "2",
        output_pattern,
        "-y",
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_msg = stderr.decode(errors="replace")[-500:]
        log.warning("scene_detection_failed", error=error_msg)
        return []

    # Collect output frames
    frames = []
    for i, path in enumerate(sorted(Path(output_dir).glob("scene_*.jpg"))):
        frames.append({
            "frame_number": i,
            "timestamp_seconds": None,  # Scene detection doesn't give exact timestamps easily
            "file_path": str(path),
            "thumbnail_path": None,
        })

    # Get timestamps via ffprobe showframes if we have frames
    if frames:
        timestamps = await _get_scene_timestamps(video_path, max_frames)
        for i, frame in enumerate(frames):
            if i < len(timestamps):
                frame["timestamp_seconds"] = timestamps[i]

    return frames


async def _get_scene_timestamps(video_path: str, max_frames: int) -> list[float]:
    """Get timestamps of scene changes using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-select_streams", "v:0",
        "-show_entries", "frame=pts_time",
        "-of", "csv=p=0",
        "-f", "lavfi",
        f"movie={video_path},select='gt(scene\\,0.3)'",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()

        if proc.returncode != 0:
            return []

        timestamps = []
        for line in stdout.decode().strip().split("\n"):
            line = line.strip()
            if line:
                try:
                    timestamps.append(float(line))
                except ValueError:
                    continue
            if len(timestamps) >= max_frames:
                break

        return timestamps
    except Exception:
        return []


async def _extract_uniform(
    video_path: str,
    output_dir: str,
    max_frames: int,
    duration: float,
) -> list[dict]:
    """Extract frames at uniform intervals."""
    # Calculate fps to extract desired number of frames
    if duration <= 0:
        return []
    fps = max_frames / duration
    if fps <= 0:
        fps = 1

    output_pattern = os.path.join(output_dir, "uniform_%04d.jpg")

    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"fps={fps:.4f}",
        "-frames:v", str(max_frames),
        "-q:v", "2",
        output_pattern,
        "-y",
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_msg = stderr.decode(errors="replace")[-500:]
        log.error("uniform_extraction_failed", error=error_msg)
        return []

    frames = []
    interval = duration / max(max_frames, 1)
    for i, path in enumerate(sorted(Path(output_dir).glob("uniform_*.jpg"))):
        frames.append({
            "frame_number": i,
            "timestamp_seconds": round(i * interval, 3),
            "file_path": str(path),
            "thumbnail_path": None,
        })

    return frames


async def _generate_thumbnail(frame_path: str, output_dir: str) -> str | None:
    """Generate a 320px-wide thumbnail for a frame."""
    if not os.path.exists(frame_path):
        return None

    name = Path(frame_path).stem
    thumb_path = os.path.join(output_dir, f"{name}_thumb.jpg")

    cmd = [
        "ffmpeg",
        "-i", frame_path,
        "-vf", "scale=320:-1",
        "-q:v", "4",
        thumb_path,
        "-y",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

        if proc.returncode == 0 and os.path.exists(thumb_path):
            return thumb_path
    except Exception as e:
        log.warning("thumbnail_generation_failed", frame=frame_path, error=str(e))

    return None
