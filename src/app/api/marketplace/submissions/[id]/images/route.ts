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

  const body = await request.json();
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
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const body = await request.json();
  const filePath = body.filePath;

  if (!filePath || typeof filePath !== "string") {
    return NextResponse.json({ error: "filePath is required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  // Delete image record
  const { error } = await serviceClient
    .from("submission_images")
    .delete()
    .eq("submission_id", id)
    .eq("contributor_id", user.id)
    .eq("file_path", filePath);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also delete from storage
  await serviceClient.storage
    .from("bounty-submissions")
    .remove([filePath]);

  return NextResponse.json({ success: true });
}
