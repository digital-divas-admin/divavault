import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { spawn } from "child_process";
import { writeFile, mkdir, unlink, readdir, stat } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const CLIP_DIR = path.join(process.cwd(), "clip-detector");
const DATA_DIR = path.join(CLIP_DIR, "data");
const MODEL_DIR = path.join(CLIP_DIR, "model");
const VENV_PYTHON = path.join(CLIP_DIR, "venv", "bin", "python3");

function runPython(script: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(VENV_PYTHON, [script, ...args], {
      cwd: CLIP_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

// GET - get status (dataset counts, model info, etc.)
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const realDir = path.join(DATA_DIR, "real");
    const aiDir = path.join(DATA_DIR, "ai");
    const modelPath = path.join(MODEL_DIR, "clip_detector.pkl");

    const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"]);

    const countImages = async (dir: string) => {
      try {
        const files = await readdir(dir);
        return files.filter((f) => exts.has(path.extname(f).toLowerCase())).length;
      } catch {
        return 0;
      }
    };

    const realCount = await countImages(realDir);
    const aiCount = await countImages(aiDir);

    let modelExists = false;
    try {
      await stat(modelPath);
      modelExists = true;
    } catch {
      // no model yet
    }

    // List images with their names
    const listImages = async (dir: string, label: string) => {
      try {
        const files = await readdir(dir);
        return files
          .filter((f) => exts.has(path.extname(f).toLowerCase()))
          .map((f) => ({ name: f, label, path: path.join(dir, f) }));
      } catch {
        return [];
      }
    };

    const realImages = await listImages(realDir, "real");
    const aiImages = await listImages(aiDir, "ai");

    return NextResponse.json({
      realCount,
      aiCount,
      modelExists,
      realImages: realImages.map((i) => i.name),
      aiImages: aiImages.map((i) => i.name),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST - actions: upload, train, check, scan, quick_test, delete
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentType = req.headers.get("content-type") || "";

  // Handle file uploads (multipart form data)
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const label = formData.get("label") as string; // "real" or "ai"
    const files = formData.getAll("files") as File[];

    if (!label || !["real", "ai"].includes(label)) {
      return NextResponse.json({ error: "Label must be 'real' or 'ai'" }, { status: 400 });
    }

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const targetDir = path.join(DATA_DIR, label);
    await mkdir(targetDir, { recursive: true });

    const uploaded: string[] = [];
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"];
      if (!allowedExts.includes(ext)) continue;

      const safeName = `${randomUUID()}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(targetDir, safeName), buffer);
      uploaded.push(safeName);
    }

    return NextResponse.json({ uploaded, count: uploaded.length });
  }

  // Handle JSON actions
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "train": {
      const result = await runPython("detect.py", ["train", "--data", DATA_DIR, "--model-dir", MODEL_DIR]);
      return NextResponse.json({
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr || undefined,
      });
    }

    case "quick_test": {
      const realDir = path.join(DATA_DIR, "real");
      const aiDir = path.join(DATA_DIR, "ai");
      const result = await runPython("quick_test.py", [realDir, aiDir]);
      return NextResponse.json({
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr || undefined,
      });
    }

    case "check": {
      const { imagePath } = body;
      if (!imagePath) return NextResponse.json({ error: "imagePath required" }, { status: 400 });
      const result = await runPython("detect.py", ["check", imagePath, "--model-dir", MODEL_DIR]);
      return NextResponse.json({
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr || undefined,
      });
    }

    case "scan": {
      const { folderPath } = body;
      if (!folderPath) return NextResponse.json({ error: "folderPath required" }, { status: 400 });
      const result = await runPython("detect.py", ["scan", folderPath, "--model-dir", MODEL_DIR]);
      return NextResponse.json({
        success: result.code === 0,
        output: result.stdout,
        error: result.stderr || undefined,
      });
    }

    case "delete_image": {
      const { fileName, label } = body;
      if (!fileName || !label || !["real", "ai"].includes(label)) {
        return NextResponse.json({ error: "fileName and label required" }, { status: 400 });
      }
      const filePath = path.join(DATA_DIR, label, fileName);
      try {
        await unlink(filePath);
        return NextResponse.json({ success: true });
      } catch {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    case "clear_dataset": {
      const { label } = body;
      if (!label || !["real", "ai"].includes(label)) {
        return NextResponse.json({ error: "label required (real or ai)" }, { status: 400 });
      }
      const dir = path.join(DATA_DIR, label);
      try {
        const files = await readdir(dir);
        for (const f of files) {
          await unlink(path.join(dir, f));
        }
        return NextResponse.json({ success: true, deleted: files.length });
      } catch {
        return NextResponse.json({ success: true, deleted: 0 });
      }
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
