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

  // Send security alert email (fire and forget)
  if (user.email) {
    import("@/lib/email")
      .then(({ sendSecurityAlert }) =>
        sendSecurityAlert(user.email!, {
          event: "Account deletion requested",
          description: `Your account deletion has been scheduled for ${scheduledFor.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. All your data including photos, matches, and consent records will be permanently removed. If you did not request this, please contact us immediately.`,
        })
      )
      .catch((err) => console.error("Deletion email error:", err));
  }

  return NextResponse.json({
    success: true,
    scheduled_for: scheduledFor.toISOString(),
  });
}
