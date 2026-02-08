import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/dashboard-queries";
import { z } from "zod";

const paymentSettingsSchema = z.object({
  paypal_email: z.string().email({ message: "Invalid email address" }).max(254).nullable(),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = paymentSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("contributors")
    .update({
      paypal_email: parsed.data.paypal_email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("Payment settings update error:", error.message);
    return NextResponse.json(
      { error: "Failed to update payment settings" },
      { status: 500 }
    );
  }

  await logActivity(
    user.id,
    "payment_settings_updated",
    parsed.data.paypal_email
      ? "Updated PayPal email for payouts"
      : "Removed PayPal email"
  );

  return NextResponse.json({ success: true });
}
