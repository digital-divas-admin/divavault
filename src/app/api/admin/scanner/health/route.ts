import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

export async function GET() {
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

  const scannerUrl = process.env.SCANNER_SERVICE_URL || "http://localhost:8000";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${scannerUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({
        status: "degraded",
        scanning: false,
        pipeline: false,
        coverage: false,
        error: `Scanner returned ${res.status}`,
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      status: "unreachable",
      scanning: false,
      pipeline: false,
      coverage: false,
      error: "Scanner service unreachable",
    });
  }
}
