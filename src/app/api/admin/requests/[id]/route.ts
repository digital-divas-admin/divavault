import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAdminRole,
  updateBountyRequest,
  publishBountyRequest,
  pauseBountyRequest,
  unpauseBountyRequest,
  closeBountyRequest,
  cancelBountyRequest,
} from "@/lib/admin-queries";
import { createRequestSchema } from "@/lib/marketplace-validators";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Pass through known business-logic messages, hide DB internals
    if (err.message.startsWith("Accepting would exceed budget")) return err.message;
    if (err.message.includes("not found")) return err.message;
    if (err.message.includes("not reviewable")) return err.message;
  }
  return "Operation failed";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
  }

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

  const { action } = body;

  try {
    let result;

    switch (action) {
      case "update": {
        const parsed = createRequestSchema.safeParse(body.data);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.issues[0].message },
            { status: 400 }
          );
        }
        result = await updateBountyRequest(id, {
          title: parsed.data.title,
          description: parsed.data.description,
          model_context: parsed.data.modelContext || null,
          category: parsed.data.category,
          track_type: parsed.data.trackType,
          pay_type: parsed.data.payType,
          pay_amount_cents: parsed.data.payAmountCents,
          set_size: parsed.data.setSize || null,
          speed_bonus_cents: parsed.data.speedBonusCents,
          speed_bonus_deadline: parsed.data.speedBonusDeadline || null,
          quality_bonus_cents: parsed.data.qualityBonusCents,
          budget_total_cents: parsed.data.budgetTotalCents,
          quantity_needed: parsed.data.quantityNeeded,
          min_resolution_width: parsed.data.minResolutionWidth,
          min_resolution_height: parsed.data.minResolutionHeight,
          quality_guidelines: parsed.data.qualityGuidelines || null,
          estimated_effort: parsed.data.estimatedEffort || null,
          visibility: parsed.data.visibility,
          deadline: parsed.data.deadline || null,
          scenario_tags: parsed.data.scenarioTags,
          setting_tags: parsed.data.settingTags,
        });
        break;
      }
      case "publish":
        result = await publishBountyRequest(id, user.id);
        break;
      case "pause":
        result = await pauseBountyRequest(id);
        break;
      case "unpause":
        result = await unpauseBountyRequest(id);
        break;
      case "close":
        result = await closeBountyRequest(id);
        break;
      case "cancel":
        result = await cancelBountyRequest(id);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    return NextResponse.json({ request: result });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err) },
      { status: 500 }
    );
  }
}
