import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { seedTestDataSchema } from "@/lib/scanner-test-validators";

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

  const parsed = seedTestDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { contributorId } = parsed.data;
  const service = await createServiceClient();

  try {
    // 1. Create a completed scan job
    const { data: scanJob, error: sjErr } = await service
      .from("scan_jobs")
      .insert({
        contributor_id: contributorId,
        scan_type: "test_seed",
        status: "completed",
        source_name: "test_seed",
        images_processed: 5,
        matches_found: 1,
        started_at: new Date(Date.now() - 60000).toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (sjErr) throw sjErr;

    // 2. Create a discovered image
    const { data: discoveredImage, error: diErr } = await service
      .from("discovered_images")
      .insert({
        scan_job_id: scanJob.id,
        source_url: `https://example.com/test-image-${Date.now()}.jpg`,
        page_url: "https://example.com/gallery/test",
        page_title: "Test Gallery Page",
        platform: "example.com",
        has_face: true,
        face_count: 1,
        width: 1024,
        height: 768,
      })
      .select("id")
      .single();

    if (diErr) throw diErr;

    // 3. Create a match
    const { data: match, error: mErr } = await service
      .from("matches")
      .insert({
        discovered_image_id: discoveredImage.id,
        contributor_id: contributorId,
        similarity_score: 0.92,
        confidence_tier: "high",
        face_index: 0,
        source_account: "test_user",
        is_known_account: false,
        is_ai_generated: false,
        status: "new",
      })
      .select("id")
      .single();

    if (mErr) throw mErr;

    // 4. Create evidence
    const { data: evidence, error: eErr } = await service
      .from("evidence")
      .insert({
        match_id: match.id,
        evidence_type: "screenshot",
        storage_url: `test/evidence/${match.id}/screenshot.png`,
        sha256_hash: `test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file_size_bytes: 245000,
      })
      .select("id")
      .single();

    if (eErr) throw eErr;

    // 5. Create a pending takedown
    const { data: takedown, error: tErr } = await service
      .from("takedowns")
      .insert({
        match_id: match.id,
        contributor_id: contributorId,
        platform: "example.com",
        takedown_type: "dmca",
        status: "pending",
      })
      .select("id")
      .single();

    if (tErr) throw tErr;

    return NextResponse.json({
      success: true,
      data: {
        scanJobId: scanJob.id,
        discoveredImageId: discoveredImage.id,
        matchId: match.id,
        evidenceId: evidence.id,
        takedownId: takedown.id,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
