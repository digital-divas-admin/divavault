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
  if (!requireScope(auth.scopes, "consent:read")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return platformJsonResponse({ error: "Invalid contributor ID" }, request, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Get the most recent consent record
  const { data: consent, error } = await supabase
    .from("contributor_consents")
    .select(
      "id, consent_version, consent_age, consent_ai_training, consent_likeness, consent_revocation, consent_privacy, allow_commercial, allow_editorial, allow_entertainment, allow_e_learning, geo_restrictions, content_exclusions, consent_hash, signed_at"
    )
    .eq("contributor_id", id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !consent) {
    return platformJsonResponse({ error: "No consent record found" }, request, { status: 404 });
  }

  return platformJsonResponse({ data: consent }, request);
}
