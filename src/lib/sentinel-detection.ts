import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

export interface SentinelDetectionResult {
  prediction: "AI-GENERATED" | "REAL";
  confidence: number;
  p_real: number;
  p_ai: number;
}

const CLIP_DETECTOR_DIR = path.resolve(process.cwd(), "clip-detector");
const PYTHON_BIN = path.join(CLIP_DETECTOR_DIR, "venv/bin/python3");
const DETECT_SCRIPT = path.join(CLIP_DETECTOR_DIR, "detect.py");

/**
 * Analyze an image with the Sentinel (CLIP-based) AI detector.
 * Accepts a pre-signed URL to avoid redundant Supabase API calls.
 * Returns null if the model isn't available or analysis fails.
 */
export async function analyzeWithSentinel(
  signedUrl: string
): Promise<SentinelDetectionResult | null> {
  const tmpPath = path.join("/tmp", `sentinel-${randomUUID()}.jpg`);

  try {
    // Download image from pre-signed URL
    const response = await fetch(signedUrl);
    if (!response.ok) {
      console.warn("[sentinel] Failed to download image:", response.status);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(tmpPath, buffer);

    // Run CLIP detector
    const { stdout } = await execFileAsync(
      PYTHON_BIN,
      [DETECT_SCRIPT, "check", tmpPath, "--json", "--model-dir", path.join(CLIP_DETECTOR_DIR, "model")],
      { timeout: 120_000 }
    );

    // Parse JSON from stdout (last valid JSON line)
    const lines = stdout.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        if (obj.prediction && obj.p_ai !== undefined) {
          return {
            prediction: obj.prediction,
            confidence: obj.confidence,
            p_real: obj.p_real,
            p_ai: obj.p_ai,
          };
        }
      } catch {
        // not JSON, skip
      }
    }

    console.warn("[sentinel] Could not parse JSON from detect.py output");
    return null;
  } catch (err) {
    console.warn("[sentinel] Analysis failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    try { await unlink(tmpPath); } catch { /* ignore cleanup errors */ }
  }
}
