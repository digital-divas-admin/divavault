import {
  verifyApiKey,
  requireScope,
  platformJsonResponse,
  unauthorizedResponse,
  forbiddenResponse,
  platformCorsResponse,
} from "@/lib/platform-auth";
import { bulkLookupSchema, bulkLookup } from "@/lib/registry";

export async function OPTIONS(request: Request) {
  return platformCorsResponse(request);
}

export async function POST(request: Request) {
  const auth = await verifyApiKey(request);
  if (!auth) return unauthorizedResponse("Invalid or missing API key", request);

  if (!requireScope(auth.scopes, "registry:read")) {
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

  const parsed = bulkLookupSchema.safeParse(body);
  if (!parsed.success) {
    return platformJsonResponse(
      { error: parsed.error.issues[0].message },
      request,
      { status: 400 }
    );
  }

  try {
    const result = await bulkLookup(parsed.data.cids);

    return platformJsonResponse(result, request);
  } catch (err) {
    console.error("Bulk lookup error:", err);
    return platformJsonResponse(
      { error: "Internal server error" },
      request,
      { status: 500 }
    );
  }
}
