import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { getContributorEmbeddingStatus } from "@/lib/scanner-test-queries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const contributorId = request.nextUrl.searchParams.get("contributorId") || "";
  if (!UUID_RE.test(contributorId)) {
    return NextResponse.json({ error: "Invalid contributor ID" }, { status: 400 });
  }

  try {
    const status = await getContributorEmbeddingStatus(contributorId);
    if (!status) {
      return NextResponse.json({ error: "Contributor not found" }, { status: 404 });
    }

    return NextResponse.json({
      images: status.images,
      uploads: status.uploads,
      embeddingsCount: status.embeddingsCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
