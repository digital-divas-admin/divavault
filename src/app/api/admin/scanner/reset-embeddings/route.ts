import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { resetEmbeddingsSchema } from "@/lib/scanner-test-validators";

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

  const parsed = resetEmbeddingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { contributorId } = parsed.data;
  const service = await createServiceClient();

  try {
    await Promise.all([
      service
        .from("contributor_images")
        .update({ embedding_status: "pending", embedding_error: null })
        .eq("contributor_id", contributorId),
      service
        .from("uploads")
        .update({ embedding_status: "pending", embedding_error: null })
        .eq("contributor_id", contributorId),
      service
        .from("contributor_embeddings")
        .delete()
        .eq("contributor_id", contributorId),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}
