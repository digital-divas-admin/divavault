import {
  verifyApiKey,
  requireScope,
  platformJsonResponse,
  unauthorizedResponse,
  forbiddenResponse,
  platformCorsResponse,
} from "@/lib/platform-auth";
import { bulkConsentSchema, bulkConsentCheck } from "@/lib/registry";

export async function OPTIONS(request: Request) {
  return platformCorsResponse(request);
}

export async function POST(request: Request) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);

  if (!requireScope(auth.scopes, "registry:consent:read")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return platformJsonResponse(
      { error: "Invalid JSON body" },
      request,
      { status: 400 }
    );
  }

  const parsed = bulkConsentSchema.safeParse(body);
  if (!parsed.success) {
    return platformJsonResponse(
      { error: parsed.error.issues[0].message },
      request,
      { status: 400 }
    );
  }

  try {
    const result = await bulkConsentCheck(
      parsed.data.cids,
      parsed.data.use_type,
      parsed.data.region,
      parsed.data.modality
    );

    return platformJsonResponse(result, request);
  } catch (err) {
    console.error("Bulk consent check error:", err);
    return platformJsonResponse(
      { error: "Internal server error" },
      request,
      { status: 500 }
    );
  }
}
