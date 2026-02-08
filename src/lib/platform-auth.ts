import { createServiceClient } from "@/lib/supabase/server";

export interface PlatformApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
}

export interface ApiKeyVerification {
  apiKey: PlatformApiKey;
  scopes: string[];
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyApiKey(
  request: Request
): Promise<ApiKeyVerification | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  const keyHash = await hashKey(token);
  const supabase = await createServiceClient();

  const { data: apiKey, error } = await supabase
    .from("platform_api_keys")
    .select("id, name, key_prefix, scopes, is_active, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !apiKey) return null;
  if (!apiKey.is_active) return null;
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) return null;

  // Update last_used_at (fire and forget)
  supabase
    .from("platform_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {});

  return {
    apiKey: apiKey as PlatformApiKey,
    scopes: apiKey.scopes as string[],
  };
}

export function requireScope(scopes: string[], required: string): boolean {
  return scopes.includes(required);
}

export async function generateApiKey(): Promise<{
  plaintextKey: string;
  keyHash: string;
  keyPrefix: string;
}> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const rawKey = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const plaintextKey = `mou_live_${rawKey}`;
  const keyHash = await hashKey(plaintextKey);
  const keyPrefix = plaintextKey.slice(0, 12);

  return { plaintextKey, keyHash, keyPrefix };
}

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = process.env.CASTMI_ORIGIN || "";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (allowedOrigin && origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
}

export function platformCorsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

export function platformJsonResponse(
  data: unknown,
  request: Request,
  init?: { status?: number }
): Response {
  const response = Response.json(data, { status: init?.status ?? 200 });
  const cors = getCorsHeaders(request);
  for (const [key, value] of Object.entries(cors)) {
    response.headers.set(key, value);
  }
  return response;
}

export function unauthorizedResponse(message = "Invalid or missing API key", request?: Request) {
  const resp = Response.json({ error: message }, { status: 401 });
  if (request) {
    const cors = getCorsHeaders(request);
    for (const [key, value] of Object.entries(cors)) {
      resp.headers.set(key, value);
    }
  }
  return resp;
}

export function forbiddenResponse(message = "Insufficient permissions", request?: Request) {
  const resp = Response.json({ error: message }, { status: 403 });
  if (request) {
    const cors = getCorsHeaders(request);
    for (const [key, value] of Object.entries(cors)) {
      resp.headers.set(key, value);
    }
  }
  return resp;
}
