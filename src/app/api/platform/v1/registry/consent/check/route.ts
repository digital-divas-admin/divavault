import {
  verifyApiKey,
  requireScope,
  platformJsonResponse,
  unauthorizedResponse,
  forbiddenResponse,
  platformCorsResponse,
} from "@/lib/platform-auth";
import { validateCID, checkConsent } from "@/lib/registry";

export async function OPTIONS(request: Request) {
  return platformCorsResponse(request);
}

export async function GET(request: Request) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);

  if (!requireScope(auth.scopes, "registry:consent:read")) {
    return forbiddenResponse("Insufficient permissions", request);
  }

  const { searchParams } = new URL(request.url);
  const cid = searchParams.get("cid");
  const useType = searchParams.get("use_type") ?? undefined;
  const region = searchParams.get("region") ?? undefined;
  const modality = searchParams.get("modality") ?? undefined;
  const verify = searchParams.get("verify") === "true";

  if (!cid) {
    return platformJsonResponse(
      { error: "Missing required parameter: cid" },
      request,
      { status: 400 }
    );
  }

  if (!validateCID(cid)) {
    return platformJsonResponse(
      { error: "Invalid CID format" },
      request,
      { status: 400 }
    );
  }

  try {
    const result = await checkConsent(cid, useType, region, modality, verify);

    return platformJsonResponse(result, request);
  } catch (err) {
    console.error("Consent check error:", err);
    return platformJsonResponse(
      { error: "Internal server error" },
      request,
      { status: 500 }
    );
  }
}
