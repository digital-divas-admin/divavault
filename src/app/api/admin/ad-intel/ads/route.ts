import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import {
  getAdIntelAds,
  insertAdIntelAd,
  logAdIntelActivity,
} from "@/lib/ad-intel-admin-queries";

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
  const page = parseInt(searchParams.get("page") || "1", 10);
  const status = searchParams.get("status") || undefined;

  try {
    const result = await getAdIntelAds({ page, status });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch ads" },
      { status: 500 }
    );
  }
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

  const url = body.url as string | undefined;
  const platform = body.platform as string | undefined;
  const advertiserName = body.advertiserName as string | undefined;

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (!platform) {
    return NextResponse.json({ error: "Missing platform" }, { status: 400 });
  }

  try {
    const adId = await insertAdIntelAd({ url, platform, advertiserName });

    await logAdIntelActivity({
      event_type: "ad_added",
      title: "Ad manually added",
      description: `Added ${platform} ad: ${url}`,
      metadata: { ad_id: adId, url, platform, advertiser_name: advertiserName },
      actor_id: user.id,
    });

    return NextResponse.json({ success: true, id: adId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add ad" },
      { status: 500 }
    );
  }
}
