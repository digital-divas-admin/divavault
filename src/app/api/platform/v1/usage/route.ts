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

export async function POST(request: NextRequest) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);
  if (!requireScope(auth.scopes, "usage:write")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return platformJsonResponse({ error: "Invalid JSON body" }, request, { status: 400 });
  }

  const contributorId = body.contributorId as string;
  const usageType = body.usageType as string;
  const metadata = (body.metadata as Record<string, unknown>) || {};

  if (!contributorId || !usageType) {
    return platformJsonResponse(
      { error: "Missing required fields: contributorId, usageType" },
      request,
      { status: 400 }
    );
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contributorId)) {
    return platformJsonResponse({ error: "Invalid contributorId" }, request, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify contributor exists and hasn't opted out
  const { data: contributor } = await supabase
    .from("contributors")
    .select("id, opted_out")
    .eq("id", contributorId)
    .single();

  if (!contributor) {
    return platformJsonResponse({ error: "Contributor not found" }, request, { status: 404 });
  }

  if (contributor.opted_out) {
    return platformJsonResponse(
      { error: "Contributor has opted out — usage not permitted" },
      request,
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("platform_usage_events")
    .insert({
      contributor_id: contributorId,
      api_key_id: auth.apiKey.id,
      usage_type: usageType,
      metadata,
    })
    .select("id")
    .single();

  if (error) {
    return platformJsonResponse({ error: "Failed to record usage" }, request, { status: 500 });
  }

  return platformJsonResponse({ data: { id: data.id } }, request, { status: 201 });
}
