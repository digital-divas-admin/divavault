import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("uploads")
    .select("*")
    .eq("contributor_id", user.id)
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: uploads, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Generate signed URLs for manual uploads
  const withUrls = await Promise.all(
    (uploads || []).map(async (upload) => {
      if (upload.source === "instagram" && upload.original_url) {
        return { ...upload, signed_url: upload.original_url };
      }
      const { data } = await supabase.storage
        .from(upload.bucket)
        .createSignedUrl(upload.file_path, 3600);
      return { ...upload, signed_url: data?.signedUrl || null };
    })
  );

  return NextResponse.json({ uploads: withUrls });
}
