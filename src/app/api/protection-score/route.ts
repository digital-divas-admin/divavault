import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProtectionScore } from "@/lib/protection-queries";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getProtectionScore(user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error computing protection score:", error);
    return NextResponse.json(
      { error: "Failed to compute protection score" },
      { status: 500 }
    );
  }
}
