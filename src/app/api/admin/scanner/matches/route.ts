import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");
  const contributorId = searchParams.get("contributor_id");
  const confidenceTier = searchParams.get("confidence_tier");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const offset = parseInt(searchParams.get("offset") || "0");

  const service = await createServiceClient();

  try {
    let query = service
      .from("matches")
      .select(
        `
        id, contributor_id, discovered_image_id,
        similarity_score, confidence_tier, status,
        is_known_account, is_ai_generated, ai_detection_score,
        face_index, created_at,
        discovered_images!inner(source_url, page_url, page_title, platform, image_stored_url),
        contributors(full_name)
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (contributorId) query = query.eq("contributor_id", contributorId);
    if (confidenceTier) query = query.eq("confidence_tier", confidenceTier);
    if (platform)
      query = query.eq("discovered_images.platform", platform);

    const { data, error, count } = await query;
    if (error) throw error;

    // Flatten the joined data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flatMatches = (data ?? []).map((m: any) => {
      const di = m.discovered_images;
      const c = m.contributors;
      return {
        id: m.id,
        contributor_id: m.contributor_id,
        discovered_image_id: m.discovered_image_id,
        similarity_score: m.similarity_score,
        confidence_tier: m.confidence_tier,
        status: m.status,
        is_known_account: m.is_known_account,
        is_ai_generated: m.is_ai_generated,
        ai_detection_score: m.ai_detection_score,
        face_index: m.face_index,
        created_at: m.created_at,
        source_url: di?.source_url ?? null,
        page_url: di?.page_url ?? null,
        page_title: di?.page_title ?? null,
        platform: di?.platform ?? null,
        image_stored_url: di?.image_stored_url ?? null,
        contributor_name: c?.full_name ?? null,
        contributor_photo_url: null as string | null,
        discovered_image_url: null as string | null,
      };
    });

    // Generate signed image URLs for side-by-side comparison
    const contributorIds = [...new Set(flatMatches.map((m) => m.contributor_id))];
    const photoMap: Record<string, { bucket: string; path: string }> = {};

    const { data: capturePhotos } = await service
      .from("contributor_images")
      .select("contributor_id, file_path, bucket")
      .in("contributor_id", contributorIds)
      .not("file_path", "is", null)
      .order("created_at", { ascending: false });

    for (const p of capturePhotos || []) {
      const cp = p as { contributor_id: string; file_path: string; bucket: string | null };
      if (!photoMap[cp.contributor_id]) {
        photoMap[cp.contributor_id] = { bucket: cp.bucket || "capture-uploads", path: cp.file_path };
      }
    }

    const missingIds = contributorIds.filter((id) => !photoMap[id]);
    if (missingIds.length > 0) {
      const { data: uploads } = await service
        .from("uploads")
        .select("contributor_id, file_path, bucket")
        .in("contributor_id", missingIds)
        .not("file_path", "is", null)
        .order("created_at", { ascending: false });

      for (const u of uploads || []) {
        const up = u as { contributor_id: string; file_path: string; bucket: string | null };
        if (!photoMap[up.contributor_id]) {
          photoMap[up.contributor_id] = { bucket: up.bucket || "sfw-uploads", path: up.file_path };
        }
      }
    }

    // Sign all URLs in parallel
    const urlPromises: Promise<void>[] = [];
    for (const m of flatMatches) {
      const ref = photoMap[m.contributor_id];
      if (ref) {
        urlPromises.push(
          service.storage.from(ref.bucket).createSignedUrl(ref.path, 3600)
            .then(({ data: d }) => { m.contributor_photo_url = d?.signedUrl ?? null; })
        );
      }
      if (m.image_stored_url) {
        urlPromises.push(
          service.storage.from("discovered-images").createSignedUrl(m.image_stored_url, 3600)
            .then(({ data: d }) => { m.discovered_image_url = d?.signedUrl ?? m.source_url; })
        );
      } else {
        m.discovered_image_url = m.source_url;
      }
    }
    await Promise.allSettled(urlPromises);

    return NextResponse.json({
      matches: flatMatches,
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Query failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

  let body: { id: string; status: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validStatuses = ["confirmed", "rejected", "false_positive"];
  if (!body.id || !validStatuses.includes(body.status)) {
    return NextResponse.json(
      {
        error: `id required, status must be one of: ${validStatuses.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const service = await createServiceClient();

  try {
    const { error } = await service
      .from("matches")
      .update({ status: body.status })
      .eq("id", body.id);

    if (error) throw error;

    return NextResponse.json({ id: body.id, status: body.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
