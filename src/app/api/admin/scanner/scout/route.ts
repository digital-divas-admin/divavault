import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

const SCANNER_URL = process.env.SCANNER_SERVICE_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id, "admin");
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const service = await createServiceClient();
  let query = service
    .from("scout_discoveries")
    .select("*")
    .order("risk_score", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
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
      headers: {
        "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `Scanner returned ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: "Scanner service is not running. Scout discovery requires the scanner Python service." },
      { status: 503 }
    );
  }
}
