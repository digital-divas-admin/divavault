import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { seedTestUsersSchema } from "@/lib/validators/test-user-seed";
import crypto from "crypto";

const TEST_NAMES = [
  "Alice Chen",
  "Marcus Johnson",
  "Priya Sharma",
  "David Kim",
  "Sofia Rodriguez",
  "James Okafor",
  "Yuki Tanaka",
  "Elena Volkov",
  "Carlos Mendez",
  "Aisha Patel",
  "Liam O'Brien",
  "Fatima Al-Hassan",
  "Noah Williams",
  "Mei Lin Wu",
  "Oliver Thompson",
  "Zara Ibrahim",
  "Ethan Park",
  "Luna Garcia",
  "Ryan Nakamura",
  "Ava Mitchell",
];

const HAIR_COLORS = ["black", "brown", "blonde", "red", "auburn", "gray"];
const EYE_COLORS = ["brown", "blue", "green", "hazel", "gray"];
const SKIN_TONES = ["fair", "light", "medium", "olive", "tan", "dark", "deep"];
const BODY_TYPES = ["slim", "average", "athletic", "curvy", "plus"];
const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];
const GENDERS = ["female", "male", "non-binary"];
const ETHNICITIES = [
  "east_asian",
  "south_asian",
  "southeast_asian",
  "black",
  "white",
  "hispanic",
  "middle_eastern",
  "mixed",
];

const PLATFORMS = [
  "civitai",
  "deviantart",
  "reddit",
  "artstation",
  "twitter",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = seedTestUsersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { count, withPhotos, withMatches, tier } = parsed.data;
  const service = await createServiceClient();
  const timestamp = Date.now();
  const password = "TestPass123!";
  const createdUsers: {
    id: string;
    email: string;
    password: string;
    name: string;
    tier: string;
  }[] = [];

  try {
    for (let i = 0; i < count; i++) {
      const name = TEST_NAMES[i % TEST_NAMES.length];
      const email = `testuser-${i + 1}-${timestamp}@madeofus.test`;

      // 1. Create auth user
      const { data: authData, error: authErr } =
        await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: name },
        });

      if (authErr) throw new Error(`Auth create failed: ${authErr.message}`);
      const userId = authData.user.id;

      // 2. Insert contributor (fully onboarded)
      const { error: contribErr } = await service.from("contributors").upsert({
        id: userId,
        full_name: name,
        email,
        verification_status: "green",
        profile_completed: true,
        consent_given: true,
        capture_completed: true,
        onboarding_completed: true,
        current_onboarding_step: 5,
        subscription_tier: tier,
        consent_timestamp: new Date().toISOString(),
        photo_count: 0,
      });

      if (contribErr)
        throw new Error(`Contributor insert failed: ${contribErr.message}`);

      // 3. Insert contributor_attributes
      const { error: attrErr } = await service
        .from("contributor_attributes")
        .upsert({
          contributor_id: userId,
          hair_color: pick(HAIR_COLORS),
          eye_color: pick(EYE_COLORS),
          skin_tone: pick(SKIN_TONES),
          body_type: pick(BODY_TYPES),
          age_range: pick(AGE_RANGES),
          gender: pick(GENDERS),
          ethnicity: pick(ETHNICITIES),
          share_hair_color: true,
          share_eye_color: true,
          share_skin_tone: true,
          share_body_type: true,
          share_age_range: true,
          share_gender: true,
          share_ethnicity: true,
        });

      if (attrErr)
        throw new Error(`Attributes insert failed: ${attrErr.message}`);

      // 4. Insert contributor_consents
      const consentHash = crypto
        .createHash("sha256")
        .update(`${userId}-${timestamp}`)
        .digest("hex");

      const { error: consentErr } = await service
        .from("contributor_consents")
        .insert({
          contributor_id: userId,
          consent_version: "1.0",
          consent_age: true,
          consent_ai_training: true,
          consent_likeness: true,
          consent_revocation: true,
          consent_privacy: true,
          allow_commercial: true,
          allow_editorial: true,
          allow_entertainment: true,
          allow_e_learning: true,
          geo_restrictions: ["global"],
          content_exclusions: [],
          consent_hash: consentHash,
          ip_address: "127.0.0.1",
          user_agent: "test-seed-api",
        });

      if (consentErr)
        throw new Error(`Consent insert failed: ${consentErr.message}`);

      // 5. Photos: fetch DeviantArt images from discovered_images and upload
      if (withPhotos) {
        const photoCount = 5 + Math.floor(Math.random() * 6); // 5-10

        const { data: sourceImages } = await service
          .from("discovered_images")
          .select("source_url, image_stored_url")
          .eq("has_face", true)
          .eq("platform", "deviantart")
          .limit(photoCount);

        const images = sourceImages || [];
        let uploaded = 0;

        // Create capture session
        const { data: captureSession, error: csErr } = await service
          .from("capture_sessions")
          .insert({
            contributor_id: userId,
            session_type: "onboarding",
            status: "completed",
            images_captured: images.length,
            images_required: 9,
            completed_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (csErr)
          throw new Error(`Capture session failed: ${csErr.message}`);

        for (let j = 0; j < images.length; j++) {
          const imgUrl = images[j].image_stored_url || images[j].source_url;
          if (!imgUrl) continue;

          try {
            const resp = await fetch(imgUrl);
            if (!resp.ok) continue;

            const buffer = Buffer.from(await resp.arrayBuffer());
            const filePath = `${userId}/seed-${j}.jpg`;

            const { error: uploadErr } = await service.storage
              .from("sfw-uploads")
              .upload(filePath, buffer, {
                contentType: "image/jpeg",
                upsert: true,
              });

            if (uploadErr) continue;

            // Insert upload record
            await service.from("uploads").insert({
              contributor_id: userId,
              source: "manual",
              file_path: filePath,
              bucket: "sfw-uploads",
              file_size: buffer.length,
              status: "active",
              embedding_status: "pending",
            });

            // Insert contributor_image record
            const steps = [
              "front_neutral",
              "front_smile",
              "left_45",
              "right_45",
              "left_profile",
              "right_profile",
              "upper_body",
              "full_body_front",
              "full_body_back",
              "expression_variety",
            ];

            await service.from("contributor_images").insert({
              contributor_id: userId,
              session_id: captureSession.id,
              capture_step: steps[j % steps.length],
              file_path: filePath,
              bucket: "sfw-uploads",
              file_size: buffer.length,
              width: 1024,
              height: 768,
              quality_score: 0.85 + Math.random() * 0.15,
              sharpness_score: 0.8 + Math.random() * 0.2,
              brightness_score: 0.7 + Math.random() * 0.3,
              embedding_status: "pending",
            });

            uploaded++;
          } catch {
            // Skip failed downloads silently
          }
        }

        // Update photo_count
        if (uploaded > 0) {
          await service
            .from("contributors")
            .update({ photo_count: uploaded })
            .eq("id", userId);
        }
      }

      // 6. Synthetic match data
      if (withMatches) {
        const matchCount = 1 + Math.floor(Math.random() * 3); // 1-3

        for (let m = 0; m < matchCount; m++) {
          const platform = pick(PLATFORMS);
          const similarity = 0.7 + Math.random() * 0.25;
          const confidence =
            similarity > 0.9 ? "high" : similarity > 0.8 ? "medium" : "low";

          // Scan job
          const { data: scanJob, error: sjErr } = await service
            .from("scan_jobs")
            .insert({
              contributor_id: userId,
              scan_type: "test_seed",
              status: "completed",
              source_name: "test_seed",
              images_processed: 10,
              matches_found: 1,
              started_at: new Date(
                Date.now() - 3600000 * (m + 1)
              ).toISOString(),
              completed_at: new Date(
                Date.now() - 3500000 * (m + 1)
              ).toISOString(),
            })
            .select("id")
            .single();

          if (sjErr) throw sjErr;

          // Discovered image
          const { data: discImg, error: diErr } = await service
            .from("discovered_images")
            .insert({
              scan_job_id: scanJob.id,
              source_url: `https://${platform}.com/test-seed-${userId}-${m}-${timestamp}.jpg`,
              page_url: `https://${platform}.com/gallery/test-${m}`,
              page_title: `Test ${platform} Gallery - Seed Match ${m + 1}`,
              platform,
              has_face: true,
              face_count: 1,
              width: 1024,
              height: 768,
            })
            .select("id")
            .single();

          if (diErr) throw diErr;

          // Match
          const statuses = ["new", "reviewing", "confirmed", "dismissed"];
          const { data: match, error: mErr } = await service
            .from("matches")
            .insert({
              discovered_image_id: discImg.id,
              contributor_id: userId,
              similarity_score: parseFloat(similarity.toFixed(4)),
              confidence_tier: confidence,
              face_index: 0,
              source_account: `seed_account_${m}`,
              is_known_account: false,
              is_ai_generated: Math.random() > 0.5,
              status: pick(statuses),
            })
            .select("id")
            .single();

          if (mErr) throw mErr;

          // Evidence
          await service.from("evidence").insert({
            match_id: match.id,
            evidence_type: "screenshot",
            storage_url: `test/evidence/${match.id}/screenshot.png`,
            sha256_hash: crypto
              .createHash("sha256")
              .update(`${match.id}-${timestamp}`)
              .digest("hex"),
            file_size_bytes: 200000 + Math.floor(Math.random() * 100000),
          });

          // Takedown (for some matches)
          if (Math.random() > 0.4) {
            const tdStatuses = [
              "pending",
              "sent",
              "acknowledged",
              "completed",
            ];
            await service.from("takedowns").insert({
              match_id: match.id,
              contributor_id: userId,
              platform,
              takedown_type: "dmca",
              status: pick(tdStatuses),
            });
          }
        }
      }

      createdUsers.push({ id: userId, email, password, name, tier });
    }

    return NextResponse.json({ success: true, users: createdUsers });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Seed failed",
        partialUsers: createdUsers,
      },
      { status: 500 }
    );
  }
}
