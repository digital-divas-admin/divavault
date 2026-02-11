import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProtectionStats } from "@/lib/protection-queries";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getProtectionStats(user.id);
  return NextResponse.json(stats);
}
