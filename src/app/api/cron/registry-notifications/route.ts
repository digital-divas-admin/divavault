import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendRegistryMatchAlert } from "@/lib/email";

const BATCH_SIZE = 50;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Fetch unnotified registry matches
  const { data: matches, error: fetchError } = await supabase
    .from("registry_matches")
    .select("id, cid, platform, confidence_tier, similarity_score")
    .is("notified_at", null)
    .eq("match_status", "pending")
    .order("discovered_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error("[registry-notifications] Fetch error:", fetchError.message);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ sent: 0, message: "No pending notifications" });
  }

  // Get unique CIDs to batch-fetch contacts
  const cids = [...new Set(matches.map((m) => m.cid))];

  const { data: contacts } = await supabase
    .from("registry_contacts")
    .select("cid, contact_value")
    .in("cid", cids)
    .eq("contact_type", "email");

  // Build CID → email lookup
  const cidEmailMap = new Map<string, string>();
  for (const contact of contacts || []) {
    cidEmailMap.set(contact.cid, contact.contact_value);
  }

  let sent = 0;
  let skipped = 0;
  const notifiedIds: string[] = [];

  for (const match of matches) {
    const email = cidEmailMap.get(match.cid);

    if (!email) {
      // No email contact — still mark as notified to avoid re-processing
      notifiedIds.push(match.id);
      skipped++;
      continue;
    }

    const statusUrl = `https://www.consentedai.com/registry/${match.cid}`;

    const result = await sendRegistryMatchAlert(email, {
      cid: match.cid,
      platform: match.platform || "unknown platform",
      confidence: match.confidence_tier,
      statusUrl,
    });

    if (result) {
      sent++;
    }
    notifiedIds.push(match.id);
  }

  // Batch-update notified_at for all processed matches
  if (notifiedIds.length > 0) {
    const { error: updateError } = await supabase
      .from("registry_matches")
      .update({ notified_at: new Date().toISOString() })
      .in("id", notifiedIds);

    if (updateError) {
      console.error(
        "[registry-notifications] Update error:",
        updateError.message
      );
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    total: matches.length,
    message: `Processed ${matches.length} matches: ${sent} emails sent, ${skipped} skipped (no email)`,
  });
}
