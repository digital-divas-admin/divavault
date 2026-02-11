import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { cleanTestDataSchema } from "@/lib/scanner-test-validators";

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

  const parsed = cleanTestDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { contributorId } = parsed.data;
  const service = await createServiceClient();

  try {
    // Find scan jobs with test_seed type for this contributor
    const { data: seedJobs } = await service
      .from("scan_jobs")
      .select("id")
      .eq("contributor_id", contributorId)
      .eq("scan_type", "test_seed");

    if (!seedJobs || seedJobs.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: { scanJobs: 0, discoveredImages: 0, matches: 0, evidence: 0, takedowns: 0 },
      });
    }

    const jobIds = seedJobs.map((j) => j.id);

    // Find discovered images from these jobs
    const { data: images } = await service
      .from("discovered_images")
      .select("id")
      .in("scan_job_id", jobIds);

    const imageIds = (images || []).map((i) => i.id);

    // Find matches from these discovered images
    let matchIds: string[] = [];
    if (imageIds.length > 0) {
      const { data: matches } = await service
        .from("matches")
        .select("id")
        .in("discovered_image_id", imageIds);

      matchIds = (matches || []).map((m) => m.id);
    }

    // Delete in order: evidence, takedowns, matches, discovered_images, scan_jobs
    let deletedEvidence = 0;
    let deletedTakedowns = 0;

    if (matchIds.length > 0) {
      const { count: evCount } = await service
        .from("evidence")
        .delete({ count: "exact" })
        .in("match_id", matchIds);
      deletedEvidence = evCount || 0;

      const { count: tdCount } = await service
        .from("takedowns")
        .delete({ count: "exact" })
        .in("match_id", matchIds);
      deletedTakedowns = tdCount || 0;

      await service.from("matches").delete().in("id", matchIds);
    }

    if (imageIds.length > 0) {
      await service.from("discovered_images").delete().in("id", imageIds);
    }

    await service.from("scan_jobs").delete().in("id", jobIds);

    return NextResponse.json({
      success: true,
      deleted: {
        scanJobs: jobIds.length,
        discoveredImages: imageIds.length,
        matches: matchIds.length,
        evidence: deletedEvidence,
        takedowns: deletedTakedowns,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
