import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify all steps are complete before finalizing
    const { data: contributor, error: fetchErr } = await supabase
      .from("contributors")
      .select("sumsub_status, profile_completed, consent_given, capture_completed, onboarding_completed")
      .eq("id", user.id)
      .single();

    if (fetchErr || !contributor) {
      return NextResponse.json(
        { error: "Contributor record not found" },
        { status: 404 }
      );
    }

    // Already completed — idempotent
    if (contributor.onboarding_completed) {
      return NextResponse.json({ success: true });
    }

    // Check step 1: Identity verified (green) or mocked
    const idVerified = contributor.sumsub_status === "green";

    // Check step 2: Profile completed
    const profileDone = contributor.profile_completed;

    // Check step 3: Consent given
    const consentDone = contributor.consent_given;

    // Check step 4: Capture completed (or has fallback uploads)
    const captureDone = contributor.capture_completed;

    if (!idVerified) {
      return NextResponse.json(
        { error: "Identity verification not complete" },
        { status: 400 }
      );
    }

    if (!profileDone) {
      return NextResponse.json(
        { error: "Profile not complete" },
        { status: 400 }
      );
    }

    if (!consentDone) {
      return NextResponse.json(
        { error: "Consent not given" },
        { status: 400 }
      );
    }

    if (!captureDone) {
      return NextResponse.json(
        { error: "Photo capture not complete" },
        { status: 400 }
      );
    }

    // Mark onboarding complete
    const { error: updateErr } = await supabase
      .from("contributors")
      .update({
        onboarding_completed: true,
        current_onboarding_step: 5,
      })
      .eq("id", user.id);

    if (updateErr) {
      console.error("Onboarding complete error:", updateErr.message);
      return NextResponse.json(
        { error: "Failed to finalize onboarding" },
        { status: 500 }
      );
    }

    // Dispatch webhook (fire and forget)
    dispatchWebhook("contributor.onboarded", {
      contributor_id: user.id,
      completed_at: new Date().toISOString(),
    }).catch((err) => console.error("Webhook dispatch error:", err));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
