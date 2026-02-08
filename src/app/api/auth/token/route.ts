import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifySsoClient } from "@/lib/sso-clients";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = body.code as string;
  const clientId = body.client_id as string;
  const clientSecret = body.client_secret as string;
  const redirectUri = body.redirect_uri as string;

  if (!code || !clientId || !clientSecret || !redirectUri) {
    return Response.json(
      { error: "Missing required fields: code, client_id, client_secret, redirect_uri" },
      { status: 400 }
    );
  }

  // Verify client credentials
  const client = await verifySsoClient(clientId, clientSecret, redirectUri);
  if (!client) {
    return Response.json({ error: "Invalid client credentials" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Look up the authorization code
  const { data: authCode, error } = await supabase
    .from("platform_cross_auth_codes")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !authCode) {
    return Response.json({ error: "Invalid authorization code" }, { status: 400 });
  }

  // Validate
  if (authCode.client_id !== clientId) {
    return Response.json({ error: "Client mismatch" }, { status: 400 });
  }
  if (authCode.redirect_uri !== redirectUri) {
    return Response.json({ error: "Redirect URI mismatch" }, { status: 400 });
  }
  if (authCode.used_at) {
    return Response.json({ error: "Authorization code already used" }, { status: 400 });
  }
  if (new Date(authCode.expires_at) < new Date()) {
    return Response.json({ error: "Authorization code expired" }, { status: 400 });
  }

  // Mark as used
  await supabase
    .from("platform_cross_auth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", authCode.id);

  // Fetch user info
  const { data: userData } = await supabase.auth.admin.getUserById(authCode.user_id);

  if (!userData?.user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch contributor status
  const { data: contributor } = await supabase
    .from("contributors")
    .select("display_name, onboarding_completed, opted_out")
    .eq("id", authCode.user_id)
    .single();

  return Response.json({
    user_id: authCode.user_id,
    email: userData.user.email,
    name: contributor?.display_name || userData.user.user_metadata?.full_name || null,
    avatar_url: userData.user.user_metadata?.avatar_url || null,
    contributor_status: {
      onboarding_completed: contributor?.onboarding_completed || false,
      opted_out: contributor?.opted_out || false,
    },
    scopes: authCode.scopes,
  });
}
