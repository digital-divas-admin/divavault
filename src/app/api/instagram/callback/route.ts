import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Handle denial
  if (errorParam) {
    return NextResponse.redirect(
      new URL("/onboarding?ig_error=denied", request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/onboarding?ig_error=missing_params", request.url)
    );
  }

  // Validate CSRF state
  const storedState = request.cookies.get("ig_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/onboarding?ig_error=invalid_state", request.url)
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Exchange code for token
    const { access_token } = await exchangeCodeForToken(code);

    // Store token in contributors table for later media fetching
    await supabase
      .from("contributors")
      .upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || "",
        email: user.email || "",
        instagram_token: access_token,
      });

    // Redirect back — client will fetch media via /api/instagram/media
    const response = NextResponse.redirect(
      new URL("/onboarding?ig_connected=true", request.url)
    );

    // Clear the state cookie
    response.cookies.delete("ig_oauth_state");

    return response;
  } catch (err) {
    console.error("Instagram callback error:", err);
    return NextResponse.redirect(
      new URL("/onboarding?ig_error=exchange_failed", request.url)
    );
  }
}
