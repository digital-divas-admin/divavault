import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { createBatchPayout } from "@/lib/paypal";
import { randomUUID } from "crypto";

export async function POST() {
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

  const serviceClient = await createServiceClient();

  // Duplicate prevention: reject if a batch is already in progress
  const { data: activeBatches } = await serviceClient
    .from("payout_batches")
    .select("id")
    .in("status", ["created", "processing"])
    .limit(1);

  if (activeBatches && activeBatches.length > 0) {
    return NextResponse.json(
      { error: "A batch payout is already in progress. Please wait for it to complete." },
      { status: 409 }
    );
  }

  // Fetch all pending earnings joined with contributor PayPal email
  const { data: pendingEarnings, error: fetchErr } = await serviceClient
    .from("earnings")
    .select("id, contributor_id, amount_cents, currency, contributors(paypal_email)")
    .eq("status", "pending");

  if (fetchErr) {
    return NextResponse.json(
      { error: "Failed to fetch pending earnings" },
      { status: 500 }
    );
  }

  if (!pendingEarnings || pendingEarnings.length === 0) {
    return NextResponse.json(
      { error: "No pending earnings to process" },
      { status: 400 }
    );
  }

  type EarningRow = {
    id: string;
    contributor_id: string;
    amount_cents: number;
    currency: string;
    contributors: { paypal_email: string | null } | null;
  };

  const earnings = pendingEarnings as unknown as EarningRow[];

  // Split into payable (has PayPal email) and skipped
  const payable = earnings.filter((e) => e.contributors?.paypal_email);
  const skippedNoPaypal = earnings.length - payable.length;

  if (payable.length === 0) {
    return NextResponse.json(
      {
        error: "No contributors have a PayPal email on file. All earnings were skipped.",
        skippedNoPaypal,
      },
      { status: 400 }
    );
  }

  const senderBatchId = `mou-${randomUUID()}`;
  const totalAmountCents = payable.reduce((sum, e) => sum + e.amount_cents, 0);

  // Create batch record
  const { error: batchInsertErr } = await serviceClient
    .from("payout_batches")
    .insert({
      sender_batch_id: senderBatchId,
      status: "created",
      total_items: payable.length,
      total_amount_cents: totalAmountCents,
      currency: "USD",
      initiated_by: user.id,
    });

  if (batchInsertErr) {
    return NextResponse.json(
      { error: "Failed to create batch record" },
      { status: 500 }
    );
  }

  // Mark included earnings as "processing"
  const earningIds = payable.map((e) => e.id);
  const { error: updateErr } = await serviceClient
    .from("earnings")
    .update({
      status: "processing",
      payout_batch_id: senderBatchId,
    })
    .in("id", earningIds);

  if (updateErr) {
    // Rollback batch
    await serviceClient
      .from("payout_batches")
      .update({ status: "failed", error_message: "Failed to update earnings status" })
      .eq("sender_batch_id", senderBatchId);

    return NextResponse.json(
      { error: "Failed to update earnings status" },
      { status: 500 }
    );
  }

  // Call PayPal
  try {
    const result = await createBatchPayout(
      senderBatchId,
      payable.map((e) => ({
        senderItemId: e.id,
        recipientEmail: e.contributors!.paypal_email!,
        amountCents: e.amount_cents,
        currency: e.currency || "USD",
      }))
    );

    // Update batch with PayPal response
    await serviceClient
      .from("payout_batches")
      .update({
        paypal_batch_id: result.paypalBatchId,
        status: "processing",
      })
      .eq("sender_batch_id", senderBatchId);

    return NextResponse.json({
      itemCount: payable.length,
      totalAmount: totalAmountCents,
      skippedNoPaypal,
      paypalBatchId: result.paypalBatchId,
    });
  } catch (err) {
    // Rollback: earnings back to "pending", batch marked "failed"
    await serviceClient
      .from("earnings")
      .update({ status: "pending", payout_batch_id: null })
      .in("id", earningIds);

    await serviceClient
      .from("payout_batches")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "PayPal API error",
        completed_at: new Date().toISOString(),
      })
      .eq("sender_batch_id", senderBatchId);

    return NextResponse.json(
      { error: "PayPal API error. Earnings have been rolled back to pending." },
      { status: 502 }
    );
  }
}
