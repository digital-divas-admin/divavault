import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { processMediaTask } from "@/lib/media-processor";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for large downloads

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { id: investigationId, mediaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await processMediaTask(mediaId, investigationId);

  if (result.success) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { success: false, error: result.error },
    { status: 500 }
  );
}
