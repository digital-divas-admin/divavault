import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validators";

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

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const {
    hairColor,
    eyeColor,
    skinTone,
    bodyType,
    ageRange,
    gender,
    ethnicity,
    selfDescription,
  } = parsed.data;

  try {
    // Ensure contributor row exists (created on first onboarding step)
    const { error: ensureErr } = await supabase
      .from("contributors")
      .upsert(
        {
          id: user.id,
          email: user.email ?? "",
          current_onboarding_step: 2,
        },
        { onConflict: "id" }
      );

    if (ensureErr) {
      console.error("Ensure contributor error:", ensureErr.message);
    }

    // Upsert into contributor_attributes
    const { error: attrErr } = await supabase
      .from("contributor_attributes")
      .upsert({
        contributor_id: user.id,
        hair_color: hairColor,
        eye_color: eyeColor,
        skin_tone: skinTone,
        body_type: bodyType,
        age_range: ageRange,
        gender,
        ethnicity: ethnicity || null,
        self_description: selfDescription || null,
        // Default share toggles to true for new profiles
        share_hair_color: true,
        share_eye_color: true,
        share_skin_tone: true,
        share_body_type: true,
        share_age_range: true,
        share_gender: true,
        share_ethnicity: true,
        updated_at: new Date().toISOString(),
      });

    if (attrErr) {
      console.error("Profile upsert error:", attrErr.message);
      return NextResponse.json(
        { error: "Failed to save profile" },
        { status: 500 }
      );
    }

    // Mark profile as completed on contributor record
    const { error: updateErr } = await supabase
      .from("contributors")
      .update({
        profile_completed: true,
        current_onboarding_step: 3,
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

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
