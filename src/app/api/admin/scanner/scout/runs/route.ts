import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

const SCANNER_URL = process.env.SCANNER_SERVICE_URL || "http://localhost:8000";

async function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id, "admin");
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${SCANNER_URL}/admin/scout/runs`, {
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
