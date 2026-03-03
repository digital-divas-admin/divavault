import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; frameId: string }> }
) {
  const { frameId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { storage_path } = body;

    if (!storage_path) {
      return NextResponse.json({ error: "storage_path is required" }, { status: 400 });
    }

    const scannerUrl = process.env.SCANNER_SERVICE_URL || "http://localhost:8000";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const scannerRes = await fetch(`${scannerUrl}/admin/deepfake/upscale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": serviceKey || "",
      },
      body: JSON.stringify({ frame_id: frameId, storage_path }),
    });

    if (!scannerRes.ok) {
      const errText = await scannerRes.text();
      return NextResponse.json(
        { error: `Scanner upscale failed: ${errText}` },
        { status: scannerRes.status }
      );
    }

    const data = await scannerRes.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
