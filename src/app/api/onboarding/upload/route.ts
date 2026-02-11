import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const filePath = body.filePath as string;
  const bucket = (body.bucket as string) || "sfw-uploads";
  const fileSize = body.fileSize as number | undefined;

  if (!filePath) {
    return NextResponse.json(
      { error: "Missing required field: filePath" },
      { status: 400 }
    );
  }

  // Sanitize filePath
  if (
    filePath.includes("..") ||
    filePath.startsWith("/") ||
    !/^[a-zA-Z0-9\-_/.]+$/.test(filePath)
  ) {
    return NextResponse.json({ error: "Invalid filePath" }, { status: 400 });
  }

  try {
    const { error } = await supabase.from("uploads").insert({
      contributor_id: user.id,
      source: "manual",
      file_path: filePath,
      bucket,
      file_size: fileSize || null,
      status: "processing",
    });

    if (error) {
      console.error("Insert upload error:", error.message);
      return NextResponse.json(
        { error: "Failed to save upload record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
