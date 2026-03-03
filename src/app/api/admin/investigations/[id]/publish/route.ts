import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { publishInvestigation, unpublishInvestigation } from "@/lib/investigation-queries";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    const body = await req.json().catch(() => ({}));
    const action = body.action || "publish";

    if (action === "unpublish") {
      const result = await unpublishInvestigation(id);
      return NextResponse.json(result);
    }

    // Lightweight check: only fetch verdict + summary, not the full detail
    const service = await createServiceClient();
    const { data: inv, error } = await service
      .from("deepfake_investigations")
      .select("verdict, summary")
      .eq("id", id)
      .single();

    if (error || !inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!inv.verdict) {
      return NextResponse.json({ error: "Verdict required before publishing" }, { status: 400 });
    }
    if (!inv.summary) {
      return NextResponse.json({ error: "Summary required before publishing" }, { status: 400 });
    }

    const result = await publishInvestigation(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
