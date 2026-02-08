import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin-queries";

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

  const url = new URL(request.url);
  const eventType = url.searchParams.get("event_type");
  const status = url.searchParams.get("status");
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));

  const serviceClient = await createServiceClient();
  let query = serviceClient
    .from("platform_webhook_deliveries")
    .select("id, endpoint_id, event_type, payload, response_status, response_body, delivered_at, attempts, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventType) query = query.eq("event_type", eventType);
  if (status) query = query.eq("status", status);

  const { data: deliveries, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch webhook log" }, { status: 500 });
  }

  return NextResponse.json({ deliveries: deliveries || [] });
}
