import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyPayPalWebhook } from "@/lib/paypal";
import { logActivity } from "@/lib/dashboard-queries";

export async function POST(request: NextRequest) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("PAYPAL_WEBHOOK_ID not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await request.text();

  // Collect headers for verification
  const headers: Record<string, string> = {};
  for (const key of [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ]) {
    headers[key] = request.headers.get(key) || "";
  }

  const isValid = await verifyPayPalWebhook(headers, body, webhookId);
  if (!isValid) {
    console.error("PayPal webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);
  const eventType = event.event_type as string;
  const resource = event.resource;

  const supabase = await createServiceClient();

  try {
    // Batch-level events
    if (eventType.startsWith("PAYMENT.PAYOUTSBATCH.")) {
      await handleBatchEvent(supabase, eventType, resource);
    }

    // Item-level events
    if (eventType.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
      await handleItemEvent(supabase, eventType, resource);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Return 200 to prevent PayPal from retrying on handler bugs
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}

type SupabaseAdmin = Awaited<ReturnType<typeof createServiceClient>>;

async function handleBatchEvent(
  supabase: SupabaseAdmin,
  eventType: string,
  resource: { batch_header: { sender_batch_header: { sender_batch_id: string }; batch_status: string } }
) {
  const senderBatchId = resource.batch_header.sender_batch_header.sender_batch_id;
  const batchStatus = resource.batch_header.batch_status;

  // Map PayPal batch status to our status
  const statusMap: Record<string, string> = {
    PROCESSING: "processing",
    SUCCESS: "success",
    CANCELED: "cancelled",
    DENIED: "failed",
  };

  const mappedStatus = statusMap[batchStatus];
  if (!mappedStatus) return;

  const updates: Record<string, unknown> = {
    status: mappedStatus,
  };

  if (["success", "failed", "cancelled"].includes(mappedStatus)) {
    updates.completed_at = new Date().toISOString();
  }

  await supabase
    .from("payout_batches")
    .update(updates)
    .eq("sender_batch_id", senderBatchId);
}

async function handleItemEvent(
  supabase: SupabaseAdmin,
  eventType: string,
  resource: {
    payout_item_id: string;
    payout_item: { sender_item_id: string };
    transaction_status?: string;
    errors?: { message: string };
  }
) {
  const earningId = resource.payout_item.sender_item_id;
  const payoutItemId = resource.payout_item_id;

  if (eventType === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED") {
    // Mark earning as paid
    await supabase
      .from("earnings")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payout_item_id: payoutItemId,
      })
      .eq("id", earningId);

    // Log activity for the contributor
    const { data: earning } = await supabase
      .from("earnings")
      .select("contributor_id, amount_cents")
      .eq("id", earningId)
      .single();

    if (earning) {
      await logActivity(
        earning.contributor_id,
        "payout_received",
        `Payment of $${((earning.amount_cents as number) / 100).toFixed(2)} sent to your PayPal.`,
        { earning_id: earningId }
      );
    }
  } else if (eventType === "PAYMENT.PAYOUTS-ITEM.UNCLAIMED") {
    await supabase
      .from("earnings")
      .update({
        status: "held",
        payout_item_id: payoutItemId,
        payout_failure_reason: "Unclaimed by recipient",
      })
      .eq("id", earningId);

    await logActivityForEarning(supabase, earningId, "payout_unclaimed", "Your payout is unclaimed. Please check your PayPal account.");
  } else {
    // FAILED, BLOCKED, DENIED, RETURNED, REFUNDED
    const reason = resource.errors?.message || resource.transaction_status || "Unknown error";

    await supabase
      .from("earnings")
      .update({
        status: "held",
        payout_item_id: payoutItemId,
        payout_failure_reason: reason,
      })
      .eq("id", earningId);

    await logActivityForEarning(supabase, earningId, "payout_failed", `Payout could not be completed: ${reason}`);
  }
}

async function logActivityForEarning(
  supabase: SupabaseAdmin,
  earningId: string,
  action: string,
  description: string
) {
  const { data: earning } = await supabase
    .from("earnings")
    .select("contributor_id")
    .eq("id", earningId)
    .single();

  if (earning) {
    await logActivity(earning.contributor_id, action, description, {
      earning_id: earningId,
    });
  }
}
