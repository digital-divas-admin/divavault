import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import {
  getAdIntelMatchDetail,
  reviewMatch,
  logAdIntelActivity,
} from "@/lib/ad-intel-admin-queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  try {
    const detail = await getAdIntelMatchDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch match" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.status as string | undefined;
  if (!status || !["confirmed", "dismissed", "escalated"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be confirmed, dismissed, or escalated." },
      { status: 400 }
    );
  }

  try {
    await reviewMatch(id, {
      status: status as "confirmed" | "dismissed" | "escalated",
      notes: (body.notes as string) || undefined,
      reviewerId: user.id,
    });

    await logAdIntelActivity({
      event_type: "match_reviewed",
      title: `Match ${status}`,
      description: `Match ${id.slice(0, 8)}... marked as ${status}`,
      metadata: {
        match_id: id,
        review_status: status,
        notes: body.notes || null,
      },
      actor_id: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Review failed" },
      { status: 500 }
    );
  }
}
