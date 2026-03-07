import {
  verifyApiKey,
  requireScope,
  platformJsonResponse,
  unauthorizedResponse,
  forbiddenResponse,
  platformCorsResponse,
} from "@/lib/platform-auth";
import { getRegistryStats } from "@/lib/registry";
import { logApiError } from "@/lib/api-logger";

export async function OPTIONS(request: Request) {
  return platformCorsResponse(request);
}

export async function GET(request: Request) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);

  if (!requireScope(auth.scopes, "registry:read")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  try {
    const stats = await getRegistryStats();

    return platformJsonResponse(stats, request);
  } catch (err) {
    logApiError("GET", "/api/platform/v1/registry/stats", "fetch stats", err);
    return platformJsonResponse(
      { error: "Internal server error" },
      request,
      { status: 500 }
    );
  }
}
