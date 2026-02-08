import { NextRequest } from "next/server";
import { getSsoClientByIdForDisplay, isValidRedirectUri } from "@/lib/sso-clients";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");

  if (!clientId || !redirectUri) {
    return Response.json(
      { error: "Missing client_id or redirect_uri" },
      { status: 400 }
    );
  }

  const client = getSsoClientByIdForDisplay(clientId);
  if (!client) {
    return Response.json({ error: "Unknown application" }, { status: 400 });
  }

  if (!isValidRedirectUri(clientId, redirectUri)) {
    return Response.json({ error: "Invalid redirect URI" }, { status: 400 });
  }

  return Response.json({ client });
}
