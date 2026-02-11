import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  // Always return 200 for Render's liveness check.
  // DB status is informational only — a failed DB connection
  // should not prevent the service from being marked as live.
  let db = "unknown";
  try {
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("contributors")
      .select("id", { count: "exact", head: true });
    db = error ? "error" : "connected";
  } catch {
    db = "unreachable";
  }

  return NextResponse.json({ status: "healthy", db });
}
