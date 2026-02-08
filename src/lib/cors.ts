import { NextResponse } from "next/server";

const allowedOrigin = () => process.env.CASTMI_ORIGIN || "";

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const configured = allowedOrigin();

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (configured && origin === configured) {
    headers["Access-Control-Allow-Origin"] = configured;
  }

  return headers;
}

export function handleCorsPreflightResponse(request: Request): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export function addCorsHeaders(response: Response, request: Request): Response {
  const headers = corsHeaders(request);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
