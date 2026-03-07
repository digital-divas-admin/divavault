import {
  verifyApiKey,
  requireScope,
  platformJsonResponse,
  unauthorizedResponse,
  forbiddenResponse,
  platformCorsResponse,
} from "@/lib/platform-auth";
import {
  validateCID,
  getIdentityByCID,
  getCurrentConsent,
  getConsentHistory,
} from "@/lib/registry";
import { logApiError } from "@/lib/api-logger";

export async function OPTIONS(request: Request) {
  return platformCorsResponse(request);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);

  if (!requireScope(auth.scopes, "registry:consent:read")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  const { cid } = await params;

  if (!validateCID(cid)) {
    return platformJsonResponse(
      { error: "Invalid CID format" },
      request,
      { status: 400 }
    );
  }

  try {
    const identity = await getIdentityByCID(cid);

    if (!identity) {
      return platformJsonResponse(
        { error: "Identity not found" },
        request,
        { status: 404 }
      );
    }

    const [currentConsent, history] = await Promise.all([
      getCurrentConsent(cid),
      getConsentHistory(cid),
    ]);

    return platformJsonResponse(
      {
        cid,
        current_consent: currentConsent,
        event_count: history.length,
        last_updated: history.at(-1)?.recorded_at ?? null,
      },
      request
    );
  } catch (err) {
    logApiError("GET", "/api/registry/identity/[cid]/consent", "consent lookup", err);
    return platformJsonResponse(
      { error: "Internal server error" },
      request,
      { status: 500 }
    );
  }
}
