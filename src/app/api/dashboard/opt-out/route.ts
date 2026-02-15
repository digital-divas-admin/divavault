import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/dashboard-queries";
import { dispatchWebhook } from "@/lib/webhooks";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get current opt-out status
  const { data: contributor } = await supabase
    .from("contributors")
    .select("opted_out")
    .eq("id", user.id)
    .single();

  if (!contributor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newOptedOut = !contributor.opted_out;

  const { error } = await supabase
    .from("contributors")
    .update({
      opted_out: newOptedOut,
      opted_out_at: newOptedOut ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity(
    user.id,
    newOptedOut ? "opted_out" : "opted_in",
    newOptedOut
      ? "Opted out of AI training"
      : "Opted back in to AI training"
  );

  // Dispatch webhook when opting out (fire and forget)
  if (newOptedOut) {
    dispatchWebhook("contributor.opted_out", {
      contributor_id: user.id,
      opted_out_at: new Date().toISOString(),
    }).catch((err) => console.error("Webhook dispatch error:", err));
  }

  // Registry consent event (non-blocking)
  (async () => {
    try {
      const { getIdentityByContributorId, recordConsentEvent, getCurrentConsent } =
        await import("@/lib/registry");
      const identity = await getIdentityByContributorId(user.id);
      if (!identity) return;

      await recordConsentEvent({
        cid: identity.cid,
        eventType: newOptedOut ? "revoke" : "reinstate",
        consentScope: newOptedOut
          ? { revocation_reason: "user_opt_out" }
          : (await getCurrentConsent(identity.cid)) || {},
        source: "dashboard",
      });

      dispatchWebhook(
        newOptedOut ? "registry.consent_revoked" : "registry.consent_updated",
        { cid: identity.cid, event_type: newOptedOut ? "revoke" : "reinstate" }
      ).catch((err) => console.error("Registry webhook error:", err));
    } catch (err) {
      console.error("Registry opt-out event error:", err);
    }
  })();

  return NextResponse.json({ success: true, opted_out: newOptedOut });
}
