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

export async function GET(request: NextRequest) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);
  if (!requireScope(auth.scopes, "contributors:read")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  const supabase = await createServiceClient();
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  const onboardingStatus = url.searchParams.get("onboarding_status");
  const consentGiven = url.searchParams.get("consent_given");
  const optedOut = url.searchParams.get("opted_out");
  const gender = url.searchParams.get("gender");
  const ageRange = url.searchParams.get("age_range");

  let query = supabase
    .from("contributors")
    .select(
      "id, display_name, onboarding_completed, consent_given, opted_out, created_at, updated_at",
      { count: "exact" }
    );

  if (onboardingStatus === "completed") {
    query = query.eq("onboarding_completed", true);
  } else if (onboardingStatus === "incomplete") {
    query = query.eq("onboarding_completed", false);
  }

  if (consentGiven === "true") query = query.eq("consent_given", true);
  if (consentGiven === "false") query = query.eq("consent_given", false);
  if (optedOut === "true") query = query.eq("opted_out", true);
  if (optedOut === "false") query = query.eq("opted_out", false);

  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data: contributors, count, error } = await query;

  if (error) {
    return platformJsonResponse({ error: "Failed to fetch contributors" }, request, { status: 500 });
  }

  let enriched = contributors || [];
  if ((gender || ageRange) && enriched.length > 0) {
    const ids = enriched.map((c) => c.id);
    let attrQuery = supabase
      .from("contributor_attributes")
      .select("contributor_id, gender, age_range")
      .in("contributor_id", ids);

    if (gender) attrQuery = attrQuery.eq("gender", gender);
    if (ageRange) attrQuery = attrQuery.eq("age_range", ageRange);

    const { data: attrs } = await attrQuery;
    if (attrs) {
      const matchIds = new Set(attrs.map((a) => a.contributor_id));
      enriched = enriched.filter((c) => matchIds.has(c.id));
    }
  }

  return platformJsonResponse({
    data: enriched,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: count ? Math.ceil(count / limit) : 0,
    },
  }, request);
}
