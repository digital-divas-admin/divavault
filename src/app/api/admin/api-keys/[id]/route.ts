import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin-queries";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await isAdmin(user.id);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.name !== undefined) updates.name = body.name;

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("platform_api_keys")
    .update(updates)
    .eq("id", id)
    .select("id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update API key" }, { status: 500 });
  }

  return NextResponse.json({ key: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await isAdmin(user.id);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("platform_api_keys")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
