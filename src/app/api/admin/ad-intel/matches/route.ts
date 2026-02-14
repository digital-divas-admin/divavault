import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { getAdIntelMatches } from "@/lib/ad-intel-admin-queries";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await requireAdmin(user.id, "admin");
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const confidence = searchParams.get("confidence") || undefined;
  const status = searchParams.get("status") || undefined;
  const matchType = searchParams.get("matchType") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  try {
    const result = await getAdIntelMatches({
      confidence,
      status,
      matchType,
      page,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
