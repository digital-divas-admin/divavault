import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const REPLICATE_MODEL_VERSION =
  "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa";
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_TIME_MS = 60_000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; frameId: string }> }
) {
  const { id: investigationId, frameId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { storage_path } = body;

    if (!storage_path) {
      return NextResponse.json(
        { error: "storage_path is required" },
        { status: 400 }
      );
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    // 1. Get signed URL for source image
    const serviceClient = await createServiceClient();
    const { data: signedData, error: signedError } = await serviceClient.storage
      .from("deepfake-evidence")
      .createSignedUrl(storage_path, 3600);

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: `Failed to get source image: ${signedError?.message}` },
        { status: 500 }
      );
    }

    // 2. Create Replicate prediction (Real-ESRGAN 4x upscale)
    const predictionRes = await fetch(
      "https://api.replicate.com/v1/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: REPLICATE_MODEL_VERSION,
          input: {
            image: signedData.signedUrl,
            scale: 4,
            face_enhance: false,
          },
        }),
      }
    );

    if (!predictionRes.ok) {
      const errText = await predictionRes.text();
      return NextResponse.json(
        { error: `Replicate prediction failed: ${errText}` },
        { status: predictionRes.status }
      );
    }

    // 3. Poll until complete (max 60s)
    let result = await predictionRes.json();
    const startTime = Date.now();

    while (result.status !== "succeeded" && result.status !== "failed") {
      if (Date.now() - startTime > MAX_POLL_TIME_MS) {
        return NextResponse.json(
          { error: "Upscale timed out after 60s" },
          { status: 504 }
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(result.urls.get, {
        headers: { Authorization: `Bearer ${replicateToken}` },
      });
      result = await pollRes.json();
    }

    if (result.status === "failed") {
      return NextResponse.json(
        { error: `Upscale failed: ${result.error || "Unknown error"}` },
        { status: 500 }
      );
    }

    // 4. Download upscaled image and upload to Supabase
    const outputUrl = Array.isArray(result.output)
      ? result.output[0]
      : result.output;
    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      return NextResponse.json(
        { error: "Failed to download upscaled image from Replicate" },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const uploadPath = `investigations/${investigationId}/upscaled/${frameId}-${Date.now()}.png`;

    const { error: uploadError } = await serviceClient.storage
      .from("deepfake-evidence")
      .upload(uploadPath, buffer, { contentType: "image/png" });

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to upload upscaled image: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 5. Return signed URL (same response shape as scanner)
    const { data: urlData, error: urlError } = await serviceClient.storage
      .from("deepfake-evidence")
      .createSignedUrl(uploadPath, 3600);

    if (urlError || !urlData?.signedUrl) {
      return NextResponse.json(
        { error: `Failed to create signed URL: ${urlError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      upscaled_url: urlData.signedUrl,
      upscaled_path: uploadPath,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
