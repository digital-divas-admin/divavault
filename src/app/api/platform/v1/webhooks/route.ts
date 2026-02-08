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

const VALID_EVENTS = [
  "contributor.onboarded",
  "contributor.consent_updated",
  "contributor.opted_out",
  "contributor.photos_added",
  "bounty.created",
  "bounty.submission_reviewed",
];

export async function GET(request: NextRequest) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);
  if (!requireScope(auth.scopes, "webhooks:manage")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  const supabase = await createServiceClient();

  const { data: endpoints, error } = await supabase
    .from("platform_webhook_endpoints")
    .select("id, url, events, is_active, created_at, updated_at")
    .eq("api_key_id", auth.apiKey.id)
    .order("created_at", { ascending: false });

  if (error) {
    return platformJsonResponse({ error: "Failed to fetch webhooks" }, request, { status: 500 });
  }

  return platformJsonResponse({ data: endpoints || [] }, request);
}

export async function POST(request: NextRequest) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);
  if (!requireScope(auth.scopes, "webhooks:manage")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return platformJsonResponse({ error: "Invalid JSON body" }, request, { status: 400 });
  }

  const url = body.url as string;
  const events = body.events as string[];
  const secret = body.secret as string;

  if (!url || !events || !secret) {
    return platformJsonResponse(
      { error: "Missing required fields: url, events, secret" },
      request,
      { status: 400 }
    );
  }

  // Validate URL
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return platformJsonResponse({ error: "Webhook URL must use HTTPS" }, request, { status: 400 });
    }
  } catch {
    return platformJsonResponse({ error: "Invalid URL" }, request, { status: 400 });
  }

  // Validate events
  if (!Array.isArray(events) || events.length === 0) {
    return platformJsonResponse({ error: "events must be a non-empty array" }, request, { status: 400 });
  }
  const invalidEvents = events.filter((e) => !VALID_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return platformJsonResponse(
      { error: `Invalid events: ${invalidEvents.join(", ")}. Valid: ${VALID_EVENTS.join(", ")}` },
      request,
      { status: 400 }
    );
  }

  if (secret.length < 16) {
    return platformJsonResponse(
      { error: "Secret must be at least 16 characters" },
      request,
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("platform_webhook_endpoints")
    .insert({
      api_key_id: auth.apiKey.id,
      url,
      events,
      secret,
    })
    .select("id, url, events, is_active, created_at")
    .single();

  if (error) {
    return platformJsonResponse({ error: "Failed to create webhook" }, request, { status: 500 });
  }

  return platformJsonResponse({ data }, request, { status: 201 });
}
