import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { getFramesForInvestigation } from "@/lib/investigation-queries";

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
    const frames = await getFramesForInvestigation(id);
    return NextResponse.json(frames);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
