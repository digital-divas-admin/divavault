import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const completeOnboardingSchema = z.object({
  consentAge: z.literal(true),
  consentAiTraining: z.literal(true),
  consentLikeness: z.literal(true),
  consentRevocation: z.literal(true),
  consentPrivacy: z.literal(true),
  consentVersion: z.string(),
  uploadedPhotos: z.array(z.string()),
  selectedPhotoIds: z.array(z.string()),
  instagramMedia: z.array(
    z.object({
      id: z.string(),
      media_url: z.string(),
    })
  ),
});

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

  const parsed = completeOnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const {
    consentAge,
    consentAiTraining,
    consentLikeness,
    consentRevocation,
    consentPrivacy,
    consentVersion,
    uploadedPhotos,
    selectedPhotoIds,
    instagramMedia,
  } = parsed.data;

  const photoCount = selectedPhotoIds.length + uploadedPhotos.length;

  try {
    // Step 1: Upsert contributor record FIRST so the FK on uploads is satisfied.
    // Set onboarding_completed = false initially; we mark it true after uploads succeed.
    const { error: upsertErr } = await supabase
      .from("contributors")
      .upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || "",
        email: user.email || "",
        track_type: "sfw" as const,
        photo_count: photoCount,
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        consent_version: consentVersion,
        consent_details: {
          consentAge,
          consentAiTraining,
          consentLikeness,
          consentRevocation,
          consentPrivacy,
        },
        onboarding_completed: false,
      });

    if (upsertErr) {
      console.error("Contributor upsert error:", upsertErr.message);
      return NextResponse.json(
        { error: "Failed to save contributor record" },
        { status: 500 }
      );
    }

    // Step 2: Insert manual upload records
    if (uploadedPhotos.length > 0) {
      const bucket = "sfw-uploads";
      const uploadRecords = uploadedPhotos.map((path) => ({
        contributor_id: user.id,
        source: "manual" as const,
        file_path: path,
        bucket,
      }));

      const { error: manualErr } = await supabase
        .from("uploads")
        .insert(uploadRecords);

      if (manualErr) {
        console.error("Manual upload insert error:", manualErr.message);
        return NextResponse.json(
          { error: "Failed to save upload records" },
          { status: 500 }
        );
      }
    }

    // Step 3: Insert Instagram upload records
    if (selectedPhotoIds.length > 0) {
      const bucket = "sfw-uploads";
      const igRecords = selectedPhotoIds.map((id) => {
        const media = instagramMedia.find((m) => m.id === id);
        return {
          contributor_id: user.id,
          source: "instagram" as const,
          file_path: `${user.id}/ig-${id}`,
          original_url: media?.media_url || null,
          bucket,
        };
      });

      const { error: igErr } = await supabase
        .from("uploads")
        .insert(igRecords);

      if (igErr) {
        console.error("Instagram upload insert error:", igErr.message);
        return NextResponse.json(
          { error: "Failed to save Instagram records" },
          { status: 500 }
        );
      }
    }

    // Step 4: Mark onboarding complete now that all uploads are saved
    const { error: completeErr } = await supabase
      .from("contributors")
      .update({ onboarding_completed: true })
      .eq("id", user.id);

    if (completeErr) {
      console.error("Onboarding complete error:", completeErr.message);
      return NextResponse.json(
        { error: "Failed to finalize onboarding" },
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
