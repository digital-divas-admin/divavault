import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

const SCANNER_URL = process.env.SCANNER_SERVICE_URL || "http://localhost:8000";

async function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id, "admin");
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const url = new URL(`${SCANNER_URL}/admin/scout/discoveries`);
    if (status) url.searchParams.set("status", status);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { "x-service-key": await getServiceKey() },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `Scanner returned ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Scanner unreachable" }, { status: 503 });
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id, "admin");
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${SCANNER_URL}/admin/scout/run`, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-service-key": await getServiceKey() },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `Scanner returned ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Scanner unreachable" }, { status: 503 });
  }
}
