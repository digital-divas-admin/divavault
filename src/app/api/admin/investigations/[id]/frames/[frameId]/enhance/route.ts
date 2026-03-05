import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { applyForensicFilter, FILTER_PRESETS } from "@/lib/forensic-filters";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; frameId: string }> }
) {
  const { id: investigationId, frameId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let tmpDir: string | null = null;

  try {
    const body = await req.json();
    const { filter, params: filterParams } = body as {
      filter: string;
      params: Record<string, number>;
    };

    // Validate filter name
    const preset = FILTER_PRESETS.find((f) => f.id === filter);
    if (!preset) {
      return NextResponse.json({ error: `Unknown filter: ${filter}` }, { status: 400 });
    }

    // Validate params are numbers within range
    for (const paramDef of preset.params) {
      const val = filterParams[paramDef.key];
      if (val === undefined) {
        filterParams[paramDef.key] = paramDef.default;
      } else if (typeof val !== "number" || val < paramDef.min || val > paramDef.max) {
        return NextResponse.json(
          { error: `${paramDef.label} must be between ${paramDef.min} and ${paramDef.max}` },
          { status: 400 }
        );
      }
    }

    // Get frame record
    const serviceClient = await createServiceClient();
    const { data: frame, error: frameErr } = await serviceClient
      .from("deepfake_frames")
      .select("storage_path")
      .eq("id", frameId)
      .eq("investigation_id", investigationId)
      .single();

    if (frameErr || !frame) {
      return NextResponse.json({ error: "Frame not found" }, { status: 404 });
    }

    // Download frame from storage
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "forensic-"));
    const inputPath = path.join(tmpDir, "input.jpg");

    const { data: fileData, error: dlErr } = await serviceClient.storage
      .from("deepfake-evidence")
      .download(frame.storage_path);

    if (dlErr || !fileData) {
      return NextResponse.json({ error: "Failed to download frame" }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    await fs.writeFile(inputPath, buffer);

    // Apply filter
    const outputPath = await applyForensicFilter(inputPath, filter, filterParams);

    // Upload result
    const outputBuffer = await fs.readFile(outputPath);
    const timestamp = Date.now();
    const storagePath = `investigations/${investigationId}/enhanced/${frameId}_${filter}_${timestamp}.jpg`;

    const { error: uploadErr } = await serviceClient.storage
      .from("deepfake-evidence")
      .upload(storagePath, outputBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
    }

    // Generate signed URL
    const { data: urlData } = await serviceClient.storage
      .from("deepfake-evidence")
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json({
      url: urlData?.signedUrl || null,
      storage_path: storagePath,
      filter,
    });
  } catch (e) {
    console.error("[forensic-enhance] Error:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
