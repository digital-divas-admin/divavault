import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id, "admin");
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = await createServiceClient();

  const { data, error } = await service
    .from("scout_keywords")
    .select("*")
    .order("category")
    .order("keyword");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id, "admin");
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { category, keyword, weight, use_for } = body as {
    category?: string;
    keyword?: string;
    weight?: number;
    use_for?: string;
  };

  if (!category || !keyword) {
    return NextResponse.json({ error: "category and keyword are required" }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data, error } = await service
    .from("scout_keywords")
    .insert({
      category,
      keyword,
      weight: weight ?? 0.1,
      use_for: use_for ?? "assess",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
