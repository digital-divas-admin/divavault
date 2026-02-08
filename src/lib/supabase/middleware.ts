import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /onboarding, /dashboard, and /admin routes
  const isProtected =
    request.nextUrl.pathname.startsWith("/onboarding") ||
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/admin");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Admin page routes: check admin role in addition to authentication.
  // Only applies to page routes (/admin/...), not API routes (/api/admin/...)
  // which handle their own auth checks and need JSON responses.
  const isAdminPage =
    request.nextUrl.pathname.startsWith("/admin") &&
    !request.nextUrl.pathname.startsWith("/api/");

  if (isAdminPage && user) {
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!adminUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Redirect logged-in users away from auth pages
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");

  if (isAuthPage && user) {
    // Check if onboarding is already complete
    const { data: contributor } = await supabase
      .from("contributors")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = contributor?.onboarding_completed ? "/dashboard" : "/onboarding";
    return NextResponse.redirect(url);
  }

  // Add security headers
  addSecurityHeaders(supabaseResponse, request);

  return supabaseResponse;
}

function addSecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Allow camera on onboarding routes for guided capture
  const isOnboarding = request.nextUrl.pathname.startsWith("/onboarding");
  response.headers.set(
    "Permissions-Policy",
    isOnboarding
      ? "camera=(self), microphone=(), geolocation=()"
      : "camera=(), microphone=(), geolocation=()"
  );

  // CSP: allow Supabase, picsum (mock images), TF.js models, SumSub
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: ${supabaseUrl} https://picsum.photos https://fastly.picsum.photos https://*.cdninstagram.com`,
    `connect-src 'self' ${supabaseUrl} https://api.instagram.com https://graph.instagram.com https://cdn.jsdelivr.net https://storage.googleapis.com https://tfhub.dev https://api.sumsub.com`,
    `frame-src 'self' https://*.sumsub.com`,
    `worker-src 'self' blob:`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
}
