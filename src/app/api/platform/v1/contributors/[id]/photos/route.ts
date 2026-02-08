import { NextRequest } from "next/server";
import {
  verifyApiKey,
  requireScope,
  unauthorizedResponse,
  forbiddenResponse,
  platformCorsResponse,
  platformJsonResponse,
} from "@/lib/platform-auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function OPTIONS(request: NextRequest) {
  return platformCorsResponse(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);
  if (!requireScope(auth.scopes, "photos:read")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return platformJsonResponse({ error: "Invalid contributor ID" }, request, { status: 400 });
  }

  const supabase = await createServiceClient();
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
  const offset = (page - 1) * limit;

  // Check contributor exists and hasn't opted out
  const { data: contributor } = await supabase
    .from("contributors")
    .select("id, opted_out")
    .eq("id", id)
    .single();

  if (!contributor) {
    return platformJsonResponse({ error: "Contributor not found" }, request, { status: 404 });
  }

  if (contributor.opted_out) {
    return platformJsonResponse(
      { error: "Contributor has opted out — photos unavailable" },
      request,
      { status: 403 }
    );
  }

  // Fetch captured images
  const { data: images, count, error } = await supabase
    .from("contributor_images")
    .select(
      "id, capture_step, file_path, bucket, quality_score, sharpness_score, brightness_score, width, height, created_at",
      { count: "exact" }
    )
    .eq("contributor_id", id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return platformJsonResponse({ error: "Failed to fetch photos" }, request, { status: 500 });
  }

  // Generate signed URLs (1-hour expiry)
  const photosWithUrls = await Promise.all(
    (images || []).map(async (img) => {
      const { data } = await supabase.storage
        .from(img.bucket)
        .createSignedUrl(img.file_path, 3600);

      return {
        id: img.id,
        capture_step: img.capture_step,
        quality_score: img.quality_score,
        sharpness_score: img.sharpness_score,
        brightness_score: img.brightness_score,
        width: img.width,
        height: img.height,
        signed_url: data?.signedUrl || null,
        expires_in: 3600,
        created_at: img.created_at,
      };
    })
  );

  return platformJsonResponse({
    data: photosWithUrls,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: count ? Math.ceil(count / limit) : 0,
    },
  }, request);
}
