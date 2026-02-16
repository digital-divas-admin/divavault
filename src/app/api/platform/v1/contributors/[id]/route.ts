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
  if (!requireScope(auth.scopes, "contributors:read")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  const { id } = await params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return platformJsonResponse({ error: "Invalid contributor ID" }, request, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: contributor, error } = await supabase
    .from("contributors")
    .select(
      "id, display_name, onboarding_completed, consent_given, opted_out, verification_status, profile_completed, capture_completed, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (error || !contributor) {
    return platformJsonResponse({ error: "Contributor not found" }, request, { status: 404 });
  }

  // Fetch attributes
  const { data: attributes } = await supabase
    .from("contributor_attributes")
    .select(
      "gender, age_range, ethnicity, hair_color, hair_type, eye_color, skin_tone, body_type, height_range"
    )
    .eq("contributor_id", id)
    .single();

  // Fetch photo counts
  const { count: captureCount } = await supabase
    .from("contributor_images")
    .select("id", { count: "exact", head: true })
    .eq("contributor_id", id);

  const { count: uploadCount } = await supabase
    .from("uploads")
    .select("id", { count: "exact", head: true })
    .eq("contributor_id", id)
    .eq("status", "approved");

  // Fetch latest consent status
  const { data: consent } = await supabase
    .from("contributor_consents")
    .select(
      "allow_commercial, allow_editorial, allow_entertainment, allow_e_learning, geo_restrictions, content_exclusions"
    )
    .eq("contributor_id", id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .single();

  return platformJsonResponse({
    data: {
      ...contributor,
      attributes: attributes || null,
      consent_categories: consent || null,
      photo_count: {
        captured: captureCount ?? 0,
        uploaded: uploadCount ?? 0,
      },
    },
  }, request);
}
