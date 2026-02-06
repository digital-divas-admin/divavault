import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifySumsubWebhook,
  mapSumsubStatus,
  type SumsubWebhookPayload,
} from "@/lib/sumsub";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-payload-digest") || "";

    // Verify webhook signature
    if (!verifySumsubWebhook(body, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload: SumsubWebhookPayload = JSON.parse(body);
    const status = mapSumsubStatus(payload);

    // Update contributor's sumsub status using service role
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("contributors")
      .update({
        sumsub_status: status,
        sumsub_applicant_id: payload.applicantId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.externalUserId);

    if (error) {
      console.error("Sumsub webhook DB update error:", error);
      return NextResponse.json(
        { error: "Database update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Sumsub webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
