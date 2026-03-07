import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logApiError } from "@/lib/api-logger";

const VERIFF_API_KEY = process.env.VERIFF_API_KEY!;
const VERIFF_BASE_URL = "https://stationapi.veriff.com/v1";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Create a Veriff verification session
    const res = await fetch(`${VERIFF_BASE_URL}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": VERIFF_API_KEY,
      },
      body: JSON.stringify({
        verification: {
          vendorData: user.id,
          person: {
            firstName: user.user_metadata?.first_name || "Contributor",
            lastName: user.user_metadata?.last_name || "",
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logApiError("POST", "/api/veriff/session", "session creation", err);
      return NextResponse.json(
        { error: "Failed to create verification session" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const sessionUrl = data.verification?.url;
    const sessionId = data.verification?.id;

    if (!sessionUrl || !sessionId) {
      logApiError("POST", "/api/veriff/session", "response missing url or id", new Error(JSON.stringify(data)));
      return NextResponse.json(
        { error: "Invalid response from verification provider" },
        { status: 500 }
      );
    }

    // Store session ID on contributor record
    await supabase
      .from("contributors")
      .update({ veriff_session_id: sessionId })
      .eq("id", user.id);

    return NextResponse.json({ sessionUrl });
  } catch (err) {
    logApiError("POST", "/api/veriff/session", "unexpected error", err);
    return NextResponse.json(
      { error: "Failed to create verification session" },
      { status: 500 }
    );
  }
}
