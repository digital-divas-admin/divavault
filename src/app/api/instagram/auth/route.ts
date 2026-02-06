import { NextRequest, NextResponse } from "next/server";
import { getInstagramAuthUrl } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = request.nextUrl.origin;

  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  // Mock mode: skip OAuth when Instagram credentials aren't configured
  if (!process.env.INSTAGRAM_CLIENT_ID) {
    return NextResponse.redirect(
      new URL("/onboarding?ig_connected=true&ig_mock=true", origin)
    );
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a cookie for validation in callback
  const response = NextResponse.redirect(getInstagramAuthUrl(state));
  response.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
