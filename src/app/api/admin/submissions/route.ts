import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, getSubmissionsForRequest, getAllPendingSubmissions } from "@/lib/admin-queries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_STATUSES = ["all", "draft", "submitted", "in_review", "accepted", "revision_requested", "rejected", "withdrawn"];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await isAdmin(user.id);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");
  const status = searchParams.get("status") || "submitted";

  if (requestId && !UUID_RE.test(requestId)) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  try {
    if (requestId) {
      const submissions = await getSubmissionsForRequest(requestId, status);
      return NextResponse.json({ submissions });
    }

    const submissions = await getAllPendingSubmissions();
    return NextResponse.json({ submissions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? "Failed to fetch submissions" : "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
