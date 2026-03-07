/**
 * Media download & frame extraction — Node.js implementation.
 *
 * Uses yt-dlp (auto-downloaded standalone binary) for social media platforms
 * and fetch() for direct URLs. Uses ffmpeg-static / ffprobe-static (npm) for
 * frame extraction — no system install needed.
 */

import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createServiceClient } from "@/lib/supabase/server";

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Binary paths
// ---------------------------------------------------------------------------

function getFfmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("ffmpeg-static") as string;
}

function getFfprobePath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("ffprobe-static").path as string;
}

const YTDLP_CACHE_DIR = path.join(process.cwd(), "node_modules", ".cache", "yt-dlp");

const YTDLP_RELEASE_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function ytdlpBinaryName(): string {
  switch (process.platform) {
    case "darwin":
      return "yt-dlp_macos";
    case "linux":
      return "yt-dlp_linux";
    case "win32":
      return "yt-dlp.exe";
    default:
      return "yt-dlp_linux";
  }
}

/** Ensure yt-dlp binary exists; download if missing. */
async function ensureYtDlp(): Promise<string> {
  const binPath = path.join(YTDLP_CACHE_DIR, "yt-dlp");

  try {
    await fs.access(binPath, fs.constants.X_OK);
    return binPath;
  } catch {
    // need to download
  }

  await fs.mkdir(YTDLP_CACHE_DIR, { recursive: true });

  const downloadUrl = `${YTDLP_RELEASE_URL}/${ytdlpBinaryName()}`;
  console.log(`[media-processor] Downloading yt-dlp from ${downloadUrl}`);

  const resp = await fetch(downloadUrl, { redirect: "follow" });
  if (!resp.ok) throw new Error(`Failed to download yt-dlp: ${resp.status}`);

  const buffer = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(binPath, buffer);
  await fs.chmod(binPath, 0o755);

  console.log("[media-processor] yt-dlp downloaded successfully");
  return binPath;
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

const YTDLP_DOMAINS = new Set([
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "fb.watch",
  "instagram.com",
  "rumble.com",
]);

function isYtDlpUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
      .toLowerCase()
      .replace(/^(www\.|m\.|mobile\.)/, "");
    return YTDLP_DOMAINS.has(hostname);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

const CONTENT_TYPE_EXT: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/x-matroska": ".mkv",
  "video/quicktime": ".mov",
  "video/x-msvideo": ".avi",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

interface DownloadResult {
  filePath: string;
  mediaType: "video" | "image" | "unknown";
}

async function downloadWithYtDlp(
  url: string,
  outputDir: string
): Promise<DownloadResult> {
  const ytdlp = await ensureYtDlp();

  const { stderr } = await execFile(
    ytdlp,
    [
      "--no-playlist",
      "--write-info-json",
      "--output",
      "%(id)s.%(ext)s",
      "--format",
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--max-filesize",
      "500M",
      url,
    ],
    { cwd: outputDir, timeout: 300_000, maxBuffer: 10 * 1024 * 1024 }
  );

  if (stderr && stderr.includes("ERROR")) {
    console.warn("[media-processor] yt-dlp stderr:", stderr.slice(-500));
  }

  // Find the downloaded media file (largest non-json file)
  const files = await fs.readdir(outputDir);
  let bestFile = "";
  let bestSize = 0;

  for (const f of files) {
    if (f.endsWith(".json")) continue;
    const stat = await fs.stat(path.join(outputDir, f));
    if (stat.size > bestSize) {
      bestSize = stat.size;
      bestFile = f;
    }
  }

  if (!bestFile) throw new Error("yt-dlp produced no output file");

  // Check info.json for media type
  let mediaType: "video" | "image" | "unknown" = "video";
  const infoFiles = files.filter((f) => f.endsWith(".info.json"));
  if (infoFiles.length > 0) {
    try {
      const info = JSON.parse(
        await fs.readFile(path.join(outputDir, infoFiles[0]), "utf-8")
      );
      if (info.vcodec === "none" && info.acodec !== "none") {
        mediaType = "unknown"; // audio-only
      }
    } catch {
      // ignore parse errors
    }
  }

  return { filePath: path.join(outputDir, bestFile), mediaType };
}

async function downloadDirect(
  url: string,
  outputDir: string
): Promise<DownloadResult> {
  const resp = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) throw new Error(`Direct download failed: ${resp.status}`);

  const contentType = resp.headers.get("content-type")?.split(";")[0] || "";
  const ext = CONTENT_TYPE_EXT[contentType] || ".bin";

  const isImage = contentType.startsWith("image/");
  const isVideo = contentType.startsWith("video/");
  const mediaType: "video" | "image" | "unknown" = isVideo
    ? "video"
    : isImage
      ? "image"
      : "unknown";

  const filename = `download${ext}`;
  const filePath = path.join(outputDir, filename);

  const buffer = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return { filePath, mediaType };
}

async function downloadMedia(
  url: string,
  outputDir: string
): Promise<DownloadResult> {
  if (isYtDlpUrl(url)) {
    return downloadWithYtDlp(url, outputDir);
  }
  return downloadDirect(url, outputDir);
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

interface MediaMetadata {
  duration_seconds: number | null;
  fps: number | null;
  codec: string | null;
  resolution_width: number | null;
  resolution_height: number | null;
  ffprobe_data: Record<string, unknown> | null;
}

async function extractMetadata(filePath: string): Promise<MediaMetadata> {
  const ffprobe = getFfprobePath();

  try {
    const { stdout } = await execFile(ffprobe, [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);

    const data = JSON.parse(stdout);
    const videoStream = (data.streams || []).find(
      (s: Record<string, unknown>) => s.codec_type === "video"
    );

    let fps: number | null = null;
    if (videoStream?.r_frame_rate) {
      const parts = (videoStream.r_frame_rate as string).split("/");
      if (parts.length === 2) {
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (den > 0) fps = Math.round((num / den) * 100) / 100;
      }
    }

    return {
      duration_seconds: data.format?.duration
        ? parseFloat(data.format.duration)
        : null,
      fps,
      codec: videoStream?.codec_name || null,
      resolution_width: videoStream?.width || null,
      resolution_height: videoStream?.height || null,
      ffprobe_data: data,
    };
  } catch (e) {
    console.warn("[media-processor] ffprobe failed:", (e as Error).message);
    return {
      duration_seconds: null,
      fps: null,
      codec: null,
      resolution_width: null,
      resolution_height: null,
      ffprobe_data: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Frame extraction
// ---------------------------------------------------------------------------

interface ExtractedFrame {
  frame_number: number;
  timestamp_seconds: number | null;
  file_path: string;
  thumbnail_path: string | null;
}

async function getDuration(filePath: string): Promise<number | null> {
  const ffprobe = getFfprobePath();
  try {
    const { stdout } = await execFile(ffprobe, [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      filePath,
    ]);
    const data = JSON.parse(stdout);
    return data.format?.duration ? parseFloat(data.format.duration) : null;
  } catch {
    return null;
  }
}

async function extractSceneFrames(
  filePath: string,
  outputDir: string,
  maxFrames: number
): Promise<ExtractedFrame[]> {
  const ffmpeg = getFfmpegPath();

  await execFile(
    ffmpeg,
    [
      "-i",
      filePath,
      "-vf",
      "select='gt(scene,0.3)',setpts=N/FRAME_RATE/TB",
      "-frames:v",
      String(maxFrames),
      "-vsync",
      "vfr",
      "-q:v",
      "2",
      path.join(outputDir, "scene_%04d.jpg"),
      "-y",
    ],
    { timeout: 300_000 }
  );

  const files = (await fs.readdir(outputDir))
    .filter((f) => f.startsWith("scene_"))
    .sort();

  // Get timestamps via ffprobe
  const ffprobe = getFfprobePath();
  let timestamps: number[] = [];
  try {
    const { stdout } = await execFile(ffprobe, [
      "-v",
      "quiet",
      "-select_streams",
      "v:0",
      "-show_entries",
      "frame=pts_time",
      "-of",
      "csv=p=0",
      "-f",
      "lavfi",
      `movie=${filePath},select='gt(scene\\,0.3)'`,
    ]);
    timestamps = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => parseFloat(l));
  } catch {
    // timestamps will be null
  }

  return files.map((f, i) => ({
    frame_number: i + 1,
    timestamp_seconds: timestamps[i] ?? null,
    file_path: path.join(outputDir, f),
    thumbnail_path: null,
  }));
}

async function extractUniformFrames(
  filePath: string,
  outputDir: string,
  maxFrames: number,
  duration: number
): Promise<ExtractedFrame[]> {
  const ffmpeg = getFfmpegPath();
  const fps = maxFrames / duration;

  await execFile(
    ffmpeg,
    [
      "-i",
      filePath,
      "-vf",
      `fps=${fps.toFixed(4)}`,
      "-frames:v",
      String(maxFrames),
      "-q:v",
      "2",
      path.join(outputDir, "uniform_%04d.jpg"),
      "-y",
    ],
    { timeout: 300_000 }
  );

  const files = (await fs.readdir(outputDir))
    .filter((f) => f.startsWith("uniform_"))
    .sort();

  return files.map((f, i) => ({
    frame_number: i + 1,
    timestamp_seconds: Math.round((i * (duration / maxFrames)) * 100) / 100,
    file_path: path.join(outputDir, f),
    thumbnail_path: null,
  }));
}

async function generateThumbnail(framePath: string): Promise<string | null> {
  const ffmpeg = getFfmpegPath();
  const parsed = path.parse(framePath);
  const thumbPath = path.join(parsed.dir, `${parsed.name}_thumb.jpg`);

  try {
    await execFile(ffmpeg, [
      "-i",
      framePath,
      "-vf",
      "scale=320:-1",
      "-q:v",
      "4",
      thumbPath,
      "-y",
    ]);
    return thumbPath;
  } catch {
    return null;
  }
}

async function extractFrames(
  filePath: string,
  outputDir: string,
  maxFrames = 20
): Promise<ExtractedFrame[]> {
  const duration = await getDuration(filePath);
  if (!duration || duration < 0.5) return [];

  const framesDir = path.join(outputDir, "frames");
  await fs.mkdir(framesDir, { recursive: true });

  // Try scene detection first
  let frames = await extractSceneFrames(filePath, framesDir, maxFrames);

  // Fall back to uniform sampling if too few scenes
  const minFrames = Math.min(5, maxFrames);
  if (frames.length < minFrames) {
    frames = await extractUniformFrames(
      filePath,
      framesDir,
      maxFrames,
      duration
    );
  }

  // Generate thumbnails for all frames
  for (const frame of frames) {
    frame.thumbnail_path = await generateThumbnail(frame.file_path);
  }

  return frames;
}

// ---------------------------------------------------------------------------
// Smart frame count scaling
// ---------------------------------------------------------------------------

function getMaxFrames(durationSeconds: number): number {
  if (durationSeconds <= 5) return 30;
  if (durationSeconds <= 15) return 60;
  if (durationSeconds <= 30) return 90;
  if (durationSeconds <= 120) return 120;
  return 150;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function processMediaTask(
  mediaId: string,
  investigationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "media-proc-"));

  try {
    // 1. Find or create task, claim it
    const { data: existingTask } = await supabase
      .from("deepfake_tasks")
      .select("id")
      .eq("media_id", mediaId)
      .eq("task_type", "download_media")
      .in("status", ["pending", "failed"])
      .limit(1)
      .single();

    const taskId = existingTask?.id;

    if (taskId) {
      await supabase
        .from("deepfake_tasks")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", taskId);
    }

    // Update media status to downloading
    await supabase
      .from("deepfake_media")
      .update({
        download_status: "downloading",
        download_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mediaId);

    // 2. Get media record
    const { data: media, error: mediaErr } = await supabase
      .from("deepfake_media")
      .select("*")
      .eq("id", mediaId)
      .single();

    if (mediaErr || !media) throw new Error("Media record not found");

    // 3. Download
    const downloadDir = path.join(tmpDir, "download");
    await fs.mkdir(downloadDir, { recursive: true });

    const { filePath, mediaType } = await downloadMedia(
      media.source_url,
      downloadDir
    );

    // 4. Upload downloaded file to storage
    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const storagePath = `investigations/${investigationId}/media/${mediaId}${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("deepfake-evidence")
      .upload(storagePath, fileBuffer, {
        contentType: ext === ".mp4" ? "video/mp4" : "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    // 5. Extract metadata
    const metadata = await extractMetadata(filePath);
    const fileStats = await fs.stat(filePath);

    // Determine final media type
    const finalMediaType =
      mediaType !== "unknown"
        ? mediaType
        : metadata.codec
          ? "video"
          : "image";

    // 6. Update media record with download results
    await supabase
      .from("deepfake_media")
      .update({
        storage_path: storagePath,
        download_status: "completed",
        download_error: null,
        media_type: finalMediaType,
        file_size_bytes: fileStats.size,
        duration_seconds: metadata.duration_seconds,
        fps: metadata.fps,
        codec: metadata.codec,
        resolution_width: metadata.resolution_width,
        resolution_height: metadata.resolution_height,
        ffprobe_data: metadata.ffprobe_data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mediaId);

    // 7. Extract frames (only for video)
    if (finalMediaType === "video" && metadata.duration_seconds) {
      const maxFrames = getMaxFrames(metadata.duration_seconds);
      const frames = await extractFrames(filePath, tmpDir, maxFrames);

      for (const frame of frames) {
        // Upload full frame
        const frameBuffer = await fs.readFile(frame.file_path);
        const frameStoragePath = `investigations/${investigationId}/frames/${mediaId}_frame_${String(frame.frame_number).padStart(4, "0")}.jpg`;

        await supabase.storage
          .from("deepfake-evidence")
          .upload(frameStoragePath, frameBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        // Upload thumbnail
        let thumbStoragePath: string | null = null;
        if (frame.thumbnail_path) {
          const thumbBuffer = await fs.readFile(frame.thumbnail_path);
          thumbStoragePath = `investigations/${investigationId}/frames/${mediaId}_frame_${String(frame.frame_number).padStart(4, "0")}_thumb.jpg`;

          await supabase.storage
            .from("deepfake-evidence")
            .upload(thumbStoragePath, thumbBuffer, {
              contentType: "image/jpeg",
              upsert: true,
            });
        }

        // Insert frame record
        await supabase.from("deepfake_frames").insert({
          media_id: mediaId,
          investigation_id: investigationId,
          frame_number: frame.frame_number,
          timestamp_seconds: frame.timestamp_seconds,
          storage_path: frameStoragePath,
          thumbnail_path: thumbStoragePath,
        });
      }

      // Log activity
      await supabase.from("deepfake_activity_log").insert({
        investigation_id: investigationId,
        event_type: "frames_extracted",
        metadata: { media_id: mediaId, frame_count: frames.length },
      });
    }

    // 8. Mark task completed
    if (taskId) {
      await supabase
        .from("deepfake_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result: {
            storage_path: storagePath,
            file_size: fileStats.size,
            media_type: finalMediaType,
          },
        })
        .eq("id", taskId);
    }

    // Log activity
    await supabase.from("deepfake_activity_log").insert({
      investigation_id: investigationId,
      event_type: "media_downloaded",
      metadata: {
        media_id: mediaId,
        file_size: fileStats.size,
        media_type: finalMediaType,
      },
    });

    return { success: true };
  } catch (e) {
    const errorMsg = (e as Error).message;
    console.error("[media-processor] Error:", errorMsg);

    // Mark media as failed
    await supabase
      .from("deepfake_media")
      .update({
        download_status: "failed",
        download_error: errorMsg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", mediaId);

    // Mark task as failed
    const { data: failedTask } = await supabase
      .from("deepfake_tasks")
      .select("id")
      .eq("media_id", mediaId)
      .eq("task_type", "download_media")
      .eq("status", "running")
      .limit(1)
      .single();

    if (failedTask) {
      await supabase
        .from("deepfake_tasks")
        .update({
          status: "failed",
          error_message: errorMsg.slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq("id", failedTask.id);
    }

    return { success: false, error: errorMsg };
  } finally {
    // Cleanup temp directory
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
