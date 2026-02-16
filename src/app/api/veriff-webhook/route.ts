import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyVeriffWebhook,
  mapVeriffStatus,
  type VeriffDecisionPayload,
} from "@/lib/veriff";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-hmac-signature") || "";

    // Verify webhook signature
    if (!verifyVeriffWebhook(body, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload: VeriffDecisionPayload = JSON.parse(body);
    const status = mapVeriffStatus(payload);
    const userId = payload.verification.vendorData;

    if (!userId) {
      console.error("Veriff webhook missing vendorData (user ID)");
      return NextResponse.json(
        { error: "Missing vendor data" },
        { status: 400 }
      );
    }

    // Update contributor's verification status using service role
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("contributors")
      .update({
        verification_status: status,
        veriff_session_id: payload.verification.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      console.error("Veriff webhook DB update error:", error);
      return NextResponse.json(
        { error: "Database update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Veriff webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
