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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);
  if (!requireScope(auth.scopes, "webhooks:manage")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return platformJsonResponse({ error: "Invalid webhook ID" }, request, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return platformJsonResponse({ error: "Invalid JSON body" }, request, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("platform_webhook_endpoints")
    .select("id, api_key_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return platformJsonResponse({ error: "Webhook not found" }, request, { status: 404 });
  }
  if (existing.api_key_id !== auth.apiKey.id) {
    return platformJsonResponse({ error: "Webhook not found" }, request, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.url !== undefined) {
    try {
      const parsed = new URL(body.url as string);
      if (parsed.protocol !== "https:") {
        return platformJsonResponse({ error: "Webhook URL must use HTTPS" }, request, { status: 400 });
      }
      updates.url = body.url;
    } catch {
      return platformJsonResponse({ error: "Invalid URL" }, request, { status: 400 });
    }
  }
  if (body.events !== undefined) updates.events = body.events;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data, error } = await supabase
    .from("platform_webhook_endpoints")
    .update(updates)
    .eq("id", id)
    .select("id, url, events, is_active, created_at, updated_at")
    .single();

  if (error) {
    return platformJsonResponse({ error: "Failed to update webhook" }, request, { status: 500 });
  }

  return platformJsonResponse({ data }, request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);
  if (!requireScope(auth.scopes, "webhooks:manage")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return platformJsonResponse({ error: "Invalid webhook ID" }, request, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("platform_webhook_endpoints")
    .select("id, api_key_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return platformJsonResponse({ error: "Webhook not found" }, request, { status: 404 });
  }
  if (existing.api_key_id !== auth.apiKey.id) {
    return platformJsonResponse({ error: "Webhook not found" }, request, { status: 404 });
  }

  const { error } = await supabase
    .from("platform_webhook_endpoints")
    .delete()
    .eq("id", id);

  if (error) {
    return platformJsonResponse({ error: "Failed to delete webhook" }, request, { status: 500 });
  }

  return platformJsonResponse({ success: true }, request);
}
