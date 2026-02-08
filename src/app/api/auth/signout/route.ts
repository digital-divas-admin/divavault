import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Redirect with a query param that the client can use to clear localStorage
  return NextResponse.redirect(new URL("/?signed_out=true", request.url), {
    status: 302,
  });
}
