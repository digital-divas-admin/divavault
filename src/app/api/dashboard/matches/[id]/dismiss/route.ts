import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { reason } = body;

  const validReasons = ["my_account", "not_me", "authorized_use", "other"];
  if (!reason || !validReasons.includes(reason)) {
    return NextResponse.json({ error: "Invalid dismiss reason" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("matches")
    .update({
      status: "dismissed",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("contributor_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
