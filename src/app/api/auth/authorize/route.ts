import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isValidRedirectUri } from "@/lib/sso-clients";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = body.client_id as string;
  const redirectUri = body.redirect_uri as string;
  const scope = body.scope as string;
  const state = body.state as string;

  if (!clientId || !redirectUri) {
    return Response.json(
      { error: "Missing client_id or redirect_uri" },
      { status: 400 }
    );
  }

  if (!isValidRedirectUri(clientId, redirectUri)) {
    return Response.json({ error: "Invalid redirect URI" }, { status: 400 });
  }

  // Generate authorization code
  const codeBytes = crypto.getRandomValues(new Uint8Array(32));
  const code = Array.from(codeBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const serviceClient = await createServiceClient();
  const scopes = scope ? scope.split(",").map((s) => s.trim()) : ["profile"];

  const { error } = await serviceClient
    .from("platform_cross_auth_codes")
    .insert({
      user_id: user.id,
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      scopes,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    });

  if (error) {
    return Response.json({ error: "Failed to generate authorization code" }, { status: 500 });
  }

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);

  return Response.json({ redirect_url: url.toString() });
}
