import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { getMediaForInvestigation, addMedia } from "@/lib/investigation-queries";
import { createServiceClient } from "@/lib/supabase/server";
import { addMediaSchema } from "@/lib/investigation-validators";
import { detectPlatform } from "@/lib/investigation-utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const media = await getMediaForInvestigation(id);
    return NextResponse.json(media);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = addMediaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Check for duplicate source_url (service role needed — deepfake_media has no public RLS)
    const serviceClient = await createServiceClient();
    const { data: existing } = await serviceClient
      .from("deepfake_media")
      .select("id")
      .eq("investigation_id", id)
      .eq("source_url", parsed.data.source_url)
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "This URL has already been added to this investigation" },
        { status: 409 }
      );
    }

    const platform = parsed.data.platform || detectPlatform(parsed.data.source_url);
    const media = await addMedia(id, {
      ...parsed.data,
      platform: platform || undefined,
    });

    return NextResponse.json(media, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
