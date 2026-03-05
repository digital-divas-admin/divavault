/**
 * Forensic image enhancement filters — FFmpeg-based implementation.
 *
 * Each filter applies a standard forensic operation (sharpen, edge detect,
 * denoise, histogram equalize, color amplify, ELA) via the ffmpeg-static
 * binary. Used by the forensic enhance API route.
 */

import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execFile = promisify(execFileCb);

function getFfmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("ffmpeg-static") as string;
}

// ---------------------------------------------------------------------------
// Filter preset definitions
// ---------------------------------------------------------------------------

export interface FilterParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface FilterPreset {
  id: string;
  label: string;
  description: string;
  params: FilterParam[];
  buildVf: (params: Record<string, number>) => string;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "sharpen",
    label: "Sharpen",
    description: "Unsharp mask to reveal hidden detail",
    params: [
      { key: "strength", label: "Strength", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
    ],
    buildVf: (p) => `unsharp=5:5:${p.strength}:5:5:0`,
  },
  {
    id: "edge_detect",
    label: "Edge Detect",
    description: "Highlight edges to reveal manipulation boundaries",
    params: [
      { key: "low", label: "Low Threshold", min: 0.01, max: 0.5, step: 0.01, default: 0.1 },
      { key: "high", label: "High Threshold", min: 0.1, max: 0.8, step: 0.01, default: 0.3 },
    ],
    buildVf: (p) => `edgedetect=low=${p.low}:high=${p.high}:mode=colormix`,
  },
  {
    id: "denoise",
    label: "Denoise",
    description: "Remove noise to reveal underlying image structure",
    params: [
      { key: "luma", label: "Luma Strength", min: 1, max: 20, step: 1, default: 6 },
      { key: "chroma", label: "Chroma Strength", min: 1, max: 20, step: 1, default: 4 },
    ],
    buildVf: (p) => `hqdn3d=${p.luma}:${p.chroma}:${p.luma}:${p.chroma}`,
  },
  {
    id: "histogram_eq",
    label: "Histogram Equalize",
    description: "Global histogram equalization to reveal hidden detail",
    params: [
      { key: "strength", label: "Strength", min: 0.1, max: 1.0, step: 0.05, default: 0.5 },
      { key: "intensity", label: "Intensity", min: 0.1, max: 1.0, step: 0.05, default: 0.5 },
    ],
    buildVf: (p) => `histeq=strength=${p.strength}:intensity=${p.intensity}`,
  },
  {
    id: "color_amplify",
    label: "Color Amplify",
    description: "Boost saturation and contrast to reveal color inconsistencies",
    params: [
      { key: "saturation", label: "Saturation", min: 1, max: 5, step: 0.1, default: 3 },
      { key: "contrast", label: "Contrast", min: 0.5, max: 3, step: 0.1, default: 1.5 },
      { key: "brightness", label: "Brightness", min: -0.3, max: 0.3, step: 0.01, default: 0 },
    ],
    buildVf: (p) => `eq=saturation=${p.saturation}:contrast=${p.contrast}:brightness=${p.brightness}`,
  },
  {
    id: "ela",
    label: "ELA (Error Level Analysis)",
    description: "Detect manipulated regions via JPEG re-compression difference",
    params: [
      { key: "quality", label: "Quality Level", min: 5, max: 30, step: 1, default: 15 },
      { key: "amplify", label: "Amplification", min: 5, max: 30, step: 1, default: 15 },
    ],
    buildVf: () => "", // ELA uses a custom pipeline, not a single -vf
  },
];

// ---------------------------------------------------------------------------
// Apply a standard filter
// ---------------------------------------------------------------------------

export async function applyForensicFilter(
  inputPath: string,
  filterId: string,
  params: Record<string, number>
): Promise<string> {
  if (filterId === "ela") {
    return applyELA(inputPath, params.quality ?? 15, params.amplify ?? 15);
  }

  const preset = FILTER_PRESETS.find((f) => f.id === filterId);
  if (!preset) throw new Error(`Unknown filter: ${filterId}`);

  const vf = preset.buildVf(params);
  const outputPath = inputPath.replace(/(\.\w+)$/, `_${filterId}$1`);
  const ffmpeg = getFfmpegPath();

  try {
    await execFile(
      ffmpeg,
      ["-i", inputPath, "-vf", vf, "-q:v", "2", outputPath, "-y"],
      { timeout: 60_000 }
    );
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr ?? "";
    const filterMatch = stderr.match(/No such filter: '?(\w+)/);
    if (filterMatch) {
      throw new Error(`FFmpeg filter "${filterMatch[1]}" not available`);
    }
    throw new Error(`Filter "${filterId}" failed: ${(err as Error).message?.slice(0, 200)}`);
  }

  return outputPath;
}

// ---------------------------------------------------------------------------
// ELA (Error Level Analysis) — custom pipeline
// ---------------------------------------------------------------------------

async function applyELA(
  inputPath: string,
  quality: number,
  amplify: number
): Promise<string> {
  const ffmpeg = getFfmpegPath();
  const dir = path.dirname(inputPath);
  const basename = path.basename(inputPath, path.extname(inputPath));

  // Step 1: Re-compress at target quality
  const recompressed = path.join(dir, `${basename}_recomp.jpg`);
  await execFile(
    ffmpeg,
    ["-i", inputPath, "-q:v", String(Math.round(31 - (quality / 30) * 28)), recompressed, "-y"],
    { timeout: 30_000 }
  );

  // Step 2: Convert to RGB, compute difference, amplify via colorlevels
  // Force RGB so "no difference" = black (0,0,0), not YUV green
  const outputPath = path.join(dir, `${basename}_ela.jpg`);
  const maxLevel = Math.max(0.001, 1 / amplify).toFixed(4);
  const filterComplex = [
    "[0:v]format=rgb24[a]",
    "[1:v]format=rgb24[b]",
    `[a][b]blend=all_mode=difference,colorlevels=rimin=0:rimax=${maxLevel}:gimin=0:gimax=${maxLevel}:bimin=0:bimax=${maxLevel}`,
  ].join(";");
  await execFile(
    ffmpeg,
    ["-i", inputPath, "-i", recompressed, "-filter_complex", filterComplex, "-q:v", "2", outputPath, "-y"],
    { timeout: 30_000 }
  );

  // Cleanup intermediate
  await fs.unlink(recompressed).catch(() => {});

  return outputPath;
}
