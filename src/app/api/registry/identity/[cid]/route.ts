import {
  verifyApiKey,
  requireScope,
  platformJsonResponse,
  unauthorizedResponse,
  forbiddenResponse,
  platformCorsResponse,
} from "@/lib/platform-auth";
import { validateCID, getIdentityByCID } from "@/lib/registry";

export async function OPTIONS(request: Request) {
  return platformCorsResponse(request);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);

  if (!requireScope(auth.scopes, "registry:read")) {
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

    return platformJsonResponse(identity, request);
  } catch (err) {
    console.error("Registry CID lookup error:", err);
    return platformJsonResponse(
      { error: "Internal server error" },
      request,
      { status: 500 }
    );
  }
}
