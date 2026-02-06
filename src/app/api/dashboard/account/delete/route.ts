import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/dashboard-queries";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scheduledFor = new Date();
  scheduledFor.setDate(scheduledFor.getDate() + 30);

  const { error } = await supabase
    .from("contributors")
    .update({
      deletion_requested_at: new Date().toISOString(),
      deletion_scheduled_for: scheduledFor.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity(
    user.id,
    "deletion_requested",
    `Account deletion scheduled for ${scheduledFor.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
  );

  return NextResponse.json({
    success: true,
    scheduled_for: scheduledFor.toISOString(),
  });
}
