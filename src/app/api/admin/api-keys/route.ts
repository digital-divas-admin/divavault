import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin-queries";
import { generateApiKey } from "@/lib/platform-auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await isAdmin(user.id);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = await createServiceClient();
  const { data: keys, error } = await serviceClient
    .from("platform_api_keys")
    .select("id, name, key_prefix, scopes, is_active, created_by, last_used_at, expires_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }

  return NextResponse.json({ keys: keys || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await isAdmin(user.id);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name as string;
  const scopes = body.scopes as string[];
  const expiresAt = body.expires_at as string | undefined;

  if (!name || !scopes || scopes.length === 0) {
    return NextResponse.json(
      { error: "Missing required fields: name, scopes" },
      { status: 400 }
    );
  }

  const validScopes = [
    "contributors:read",
    "consent:read",
    "photos:read",
    "usage:write",
    "webhooks:manage",
  ];
  const invalidScopes = scopes.filter((s) => !validScopes.includes(s));
  if (invalidScopes.length > 0) {
    return NextResponse.json(
      { error: `Invalid scopes: ${invalidScopes.join(", ")}` },
      { status: 400 }
    );
  }

  const { plaintextKey, keyHash, keyPrefix } = await generateApiKey();

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("platform_api_keys")
    .insert({
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
      created_by: user.id,
      expires_at: expiresAt || null,
    })
    .select("id, name, key_prefix, scopes, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }

  // Return plaintext key ONCE — it cannot be retrieved again
  return NextResponse.json(
    { key: data, plaintext_key: plaintextKey },
    { status: 201 }
  );
}
