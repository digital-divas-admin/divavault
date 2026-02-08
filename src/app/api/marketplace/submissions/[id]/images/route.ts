import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { addImageSchema } from "@/lib/marketplace-validators";

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify submission ownership
  const { data: submission } = await supabase
    .from("bounty_submissions")
    .select("id, contributor_id, status")
    .eq("id", id)
    .eq("contributor_id", user.id)
    .single();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.status !== "draft" && submission.status !== "revision_requested") {
    return NextResponse.json(
      { error: "Cannot add images at this stage" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const result = addImageSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();
  const { data: image, error } = await serviceClient
    .from("submission_images")
    .insert({
      submission_id: id,
      contributor_id: user.id,
      file_path: result.data.filePath,
      bucket: result.data.bucket,
      file_size: result.data.fileSize || null,
      width: result.data.width || null,
      height: result.data.height || null,
      caption: result.data.caption || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Insert submission image error:", error.message);
    return NextResponse.json({ error: "Failed to save image record" }, { status: 500 });
  }

  return NextResponse.json({ image }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify submission ownership
  const { data: submission } = await supabase
    .from("bounty_submissions")
    .select("id, contributor_id, status")
    .eq("id", id)
    .eq("contributor_id", user.id)
    .single();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.status !== "draft" && submission.status !== "revision_requested") {
    return NextResponse.json(
      { error: "Cannot remove images at this stage" },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const filePath = body.filePath;

  if (!filePath || typeof filePath !== "string") {
    return NextResponse.json({ error: "filePath is required" }, { status: 400 });
  }

  // Validate file path belongs to this user (prevent path traversal)
  const pathPattern = /^[a-f0-9-]+\/[^/]+$/;
  if (!filePath.startsWith(`${user.id}/`) || !pathPattern.test(filePath)) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  // Delete from storage first — if this fails, DB record stays intact
  const { error: storageErr } = await serviceClient.storage
    .from("bounty-submissions")
    .remove([filePath]);

  if (storageErr) {
    console.error("Storage delete failed:", storageErr.message);
    return NextResponse.json(
      { error: "Failed to delete file from storage" },
      { status: 500 }
    );
  }

  // Then delete DB record
  const { error } = await serviceClient
    .from("submission_images")
    .delete()
    .eq("submission_id", id)
    .eq("contributor_id", user.id)
    .eq("file_path", filePath);

  if (error) {
    console.error("DB delete failed after storage delete:", error.message);
    return NextResponse.json(
      { error: "Failed to delete image record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
