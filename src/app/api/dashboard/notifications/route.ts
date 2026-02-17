import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: notifications, error } = await supabase
    .from("scanner_notifications")
    .select("id, notification_type, title, body, data, read, created_at")
    .eq("contributor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }

  return NextResponse.json({ notifications: notifications || [] });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ids?: string[]; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.markAllRead) {
    const { error } = await supabase
      .from("scanner_notifications")
      .update({ read: true })
      .eq("contributor_id", user.id)
      .eq("read", false);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
    const { error } = await supabase
      .from("scanner_notifications")
      .update({ read: true })
      .eq("contributor_id", user.id)
      .in("id", body.ids);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: "Provide ids array or markAllRead: true" },
    { status: 400 }
  );
}
