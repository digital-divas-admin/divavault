import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublishedRequests } from "@/lib/marketplace-queries";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requests = await getPublishedRequests();
    return NextResponse.json({ requests });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
