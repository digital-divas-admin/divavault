import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTierCapabilities } from "@/lib/tier-capabilities";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { takedown_type } = body;

  if (!takedown_type || !["dmca", "platform_report"].includes(takedown_type)) {
    return NextResponse.json({ error: "Invalid takedown type" }, { status: 400 });
  }

  // Check tier capabilities
  const { data: contributor } = await supabase
    .from("contributors")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = getTierCapabilities(contributor?.subscription_tier);
  if (!tier.canRequestTakedown) {
    return NextResponse.json({ error: "Upgrade required to request takedowns" }, { status: 403 });
  }

  // Verify match ownership and get platform
  const { data: match } = await supabase
    .from("matches")
    .select("id, discovered_images!inner(platform)")
    .eq("id", id)
    .eq("contributor_id", user.id)
    .single();

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const di = match.discovered_images as unknown as Record<string, unknown>;
  const platform = (di?.platform as string) || "unknown";

  // Insert takedown
  const { data: takedown, error: tdError } = await supabase
    .from("takedowns")
    .insert({
      match_id: id,
      contributor_id: user.id,
      platform,
      takedown_type,
      status: "pending",
    })
    .select()
    .single();

  if (tdError) {
    return NextResponse.json({ error: "Failed to create takedown" }, { status: 500 });
  }

  // Update match status
  await supabase
    .from("matches")
    .update({ status: "takedown_filed" })
    .eq("id", id)
    .eq("contributor_id", user.id);

  // Send takedown confirmation email (fire and forget)
  if (user.email) {
    import("@/lib/email")
      .then(({ sendTakedownUpdate }) =>
        sendTakedownUpdate(user.email!, {
          platform,
          status: "pending",
        })
      )
      .catch((err) => console.error("Takedown email error:", err));
  }

  return NextResponse.json(takedown, { status: 201 });
}
