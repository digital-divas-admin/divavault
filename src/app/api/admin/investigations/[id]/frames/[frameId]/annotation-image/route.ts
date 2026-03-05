import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { annotateFrame, createEvidence } from "@/lib/investigation-queries";

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const image = formData.get("image") as File | null;
  const createEvidenceFlag = formData.get("create_evidence") === "true";
  const evidenceTitle = formData.get("evidence_title") as string | null;

  if (!image || !(image instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  // 10MB limit
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
  }

  try {
    const serviceClient = await createServiceClient();
    const timestamp = Date.now();
    const storagePath = `annotations/${investigationId}/${frameId}-${timestamp}.png`;

    const arrayBuffer = await image.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from("deepfake-evidence")
      .upload(storagePath, arrayBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Annotation image upload error:", uploadError.message);
      return NextResponse.json({ error: "Failed to upload annotation image" }, { status: 500 });
    }

    // Update frame's annotation_image_path (via annotateFrame for activity logging)
    await annotateFrame(frameId, { annotation_image_path: storagePath });

    // Get frame number for richer evidence content
    const { data: frameRecord } = await serviceClient
      .from("deepfake_frames")
      .select("frame_number")
      .eq("id", frameId)
      .single();
    const frameNumber = frameRecord?.frame_number ?? frameId.slice(0, 8);

    // Create evidence record if requested
    let evidenceRecord = null;
    if (createEvidenceFlag) {
      evidenceRecord = await createEvidence(investigationId, {
        evidence_type: "screenshot",
        title: evidenceTitle || `Annotated Frame #${frameNumber}`,
        content: `Analyst-annotated frame highlighting areas of interest in frame #${frameNumber}.`,
        attachment_path: storagePath,
      });
    }

    // Sign the URL for immediate use
    const { data: signedData } = await serviceClient.storage
      .from("deepfake-evidence")
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json({
      annotation_image_path: storagePath,
      annotation_image_url: signedData?.signedUrl || null,
      evidence: evidenceRecord,
    });
  } catch (e) {
    console.error("Annotation image error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
