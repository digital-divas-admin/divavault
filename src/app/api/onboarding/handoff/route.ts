import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

const HANDOFF_SECRET = process.env.SUMSUB_SECRET_KEY!; // Reuse existing secret

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Allow empty body
  }

  const step = (body.step as number) || 1;

  // Generate a short-lived handoff token (15 min expiry)
  const payload = {
    userId: user.id,
    step,
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", HANDOFF_SECRET);
  hmac.update(payloadStr);
  const signature = hmac.digest("base64url");

  const token = `${payloadStr}.${signature}`;

  // Build handoff URL — use NEXT_PUBLIC_SITE_URL if set, otherwise
  // derive from request. In dev, prefer the network IP so phones can reach it.
  const requestOrigin = request.headers.get("origin")
    || request.headers.get("referer")?.replace(/\/[^/]*$/, "");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || requestOrigin;

  if (!origin) {
    return NextResponse.json(
      { error: "Cannot determine site origin. Set NEXT_PUBLIC_SITE_URL." },
      { status: 500 }
    );
  }

  const url = `${origin}/onboarding?handoff=${token}`;

  return NextResponse.json({ url, expiresIn: 900 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const [payloadStr, signature] = parts;

  // Verify signature (timing-safe comparison to prevent timing attacks)
  const hmac = crypto.createHmac("sha256", HANDOFF_SECRET);
  hmac.update(payloadStr);
  const expectedSig = hmac.digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Check expiry
  const payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 });
  }

  return NextResponse.json({ userId: payload.userId, step: payload.step || 1, valid: true });
}
