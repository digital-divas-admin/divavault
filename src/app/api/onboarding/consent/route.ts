import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consentConfigSchema } from "@/lib/validators";
import { dispatchWebhook } from "@/lib/webhooks";

export async function POST(request: NextRequest) {
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

  // Extract consent hash and audit fields from body before validation
  const rawBody = body as Record<string, unknown>;
  const consentHash = rawBody.consentHash as string;
  const userAgent = rawBody.userAgent as string;

  const parsed = consentConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  if (!consentHash) {
    return NextResponse.json(
      { error: "Missing consent hash" },
      { status: 400 }
    );
  }

  const {
    consentAge,
    consentAiTraining,
    consentLikeness,
    consentRevocation,
    consentPrivacy,
    allowCommercial,
    allowEditorial,
    allowEntertainment,
    allowELearning,
    geoRestrictions,
    contentExclusions,
    consentVersion,
  } = parsed.data;

  // Get IP from request headers
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  try {
    // Ensure contributor row exists
    const { error: upsertError } = await supabase
      .from("contributors")
      .upsert(
        { id: user.id, email: user.email ?? "" },
        { onConflict: "id" }
      );

    if (upsertError) {
      console.error("Contributor upsert error:", upsertError.message);
      return NextResponse.json(
        { error: "Failed to initialize contributor record" },
        { status: 500 }
      );
    }

    // Insert immutable consent record
    const { error: consentErr } = await supabase
      .from("contributor_consents")
      .insert({
        contributor_id: user.id,
        consent_version: consentVersion,
        consent_age: consentAge,
        consent_ai_training: consentAiTraining,
        consent_likeness: consentLikeness,
        consent_revocation: consentRevocation,
        consent_privacy: consentPrivacy,
        allow_commercial: allowCommercial,
        allow_editorial: allowEditorial,
        allow_entertainment: allowEntertainment,
        allow_e_learning: allowELearning,
        geo_restrictions: geoRestrictions,
        content_exclusions: contentExclusions,
        consent_hash: consentHash,
        ip_address: ip,
        user_agent: userAgent || null,
        signed_at: new Date().toISOString(),
      });

    if (consentErr) {
      console.error("Consent insert error:", consentErr.message);
      return NextResponse.json(
        { error: "Failed to save consent" },
        { status: 500 }
      );
    }

    // Update contributor record
    const { error: updateErr } = await supabase
      .from("contributors")
      .update({
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        consent_version: consentVersion,
        consent_details: {
          consentAge,
          consentAiTraining,
          consentLikeness,
          consentRevocation,
          consentPrivacy,
          allowCommercial,
          allowEditorial,
          allowEntertainment,
          allowELearning,
          geoRestrictions,
          contentExclusions,
        },
        current_onboarding_step: 4,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateErr) {
      console.error("Contributor update error:", updateErr.message);
      return NextResponse.json(
        { error: "Failed to update contributor" },
        { status: 500 }
      );
    }

    // Dispatch webhook (fire and forget)
    dispatchWebhook("contributor.consent_updated", {
      contributor_id: user.id,
      consent_version: consentVersion,
      categories: {
        commercial: allowCommercial,
        editorial: allowEditorial,
        entertainment: allowEntertainment,
        e_learning: allowELearning,
      },
    }).catch((err) => console.error("Webhook dispatch error:", err));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
