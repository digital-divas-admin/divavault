import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, getAdminRole, createBountyRequest } from "@/lib/admin-queries";
import { createRequestSchema } from "@/lib/marketplace-validators";
import { dispatchWebhook } from "@/lib/webhooks";

export async function GET() {
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

  const { data: requests, error } = await supabase
    .from("bounty_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }

  return NextResponse.json({ requests: requests || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getAdminRole(user.id);
  if (!role || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = createRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  // Force status to "draft" on creation — publish must go through PATCH
  const status = result.data.status === "published" ? "draft" : (result.data.status || "draft");

  try {
    const bountyRequest = await createBountyRequest(user.id, {
      title: result.data.title,
      description: result.data.description,
      model_context: result.data.modelContext,
      category: result.data.category,
      track_type: result.data.trackType,
      pay_type: result.data.payType,
      pay_amount_cents: result.data.payAmountCents,
      set_size: result.data.setSize,
      speed_bonus_cents: result.data.speedBonusCents,
      speed_bonus_deadline: result.data.speedBonusDeadline,
      quality_bonus_cents: result.data.qualityBonusCents,
      budget_total_cents: result.data.budgetTotalCents,
      quantity_needed: result.data.quantityNeeded,
      min_resolution_width: result.data.minResolutionWidth,
      min_resolution_height: result.data.minResolutionHeight,
      quality_guidelines: result.data.qualityGuidelines,
      estimated_effort: result.data.estimatedEffort,
      visibility: result.data.visibility,
      deadline: result.data.deadline,
      scenario_tags: result.data.scenarioTags,
      setting_tags: result.data.settingTags,
      status,
    });

    // Dispatch webhook (fire and forget)
    dispatchWebhook("bounty.created", {
      request_id: bountyRequest.id,
      title: bountyRequest.title,
      category: bountyRequest.category,
      status: bountyRequest.status,
      created_by: user.id,
    }).catch((err) => console.error("Webhook dispatch error:", err));

    return NextResponse.json({ request: bountyRequest }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}
