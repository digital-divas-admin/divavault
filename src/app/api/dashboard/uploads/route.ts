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
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: uploads, error } = await query;

  if (error) {
    console.error("Uploads query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch uploads" }, { status: 500 });
  }

  // Generate signed URLs — use allSettled so one broken file doesn't crash the whole list
  const results = await Promise.allSettled(
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

  const withUrls = results.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : { ...(uploads || [])[i], signed_url: null }
  );

  return NextResponse.json({ uploads: withUrls });
}
