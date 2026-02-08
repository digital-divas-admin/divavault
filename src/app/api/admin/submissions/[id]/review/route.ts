import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole, reviewSubmission } from "@/lib/admin-queries";
import { reviewSubmissionSchema } from "@/lib/marketplace-validators";
import { dispatchWebhook } from "@/lib/webhooks";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.startsWith("Accepting would exceed budget")) return err.message;
    if (err.message.startsWith("Cannot review submissions")) return err.message;
    if (err.message.includes("not found")) return err.message;
    if (err.message.includes("not reviewable")) return err.message;
  }
  return "Review failed";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid submission ID" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getAdminRole(user.id);
  if (!role || !["reviewer", "admin", "super_admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reviewSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Only admin/super_admin can accept; reviewer+ can reject/revision
  if (parsed.data.action === "accept" && role === "reviewer") {
    return NextResponse.json(
      { error: "Only admins can accept submissions" },
      { status: 403 }
    );
  }

  try {
    const submission = await reviewSubmission(
      id,
      parsed.data.action,
      parsed.data.feedback,
      user.id,
      parsed.data.awardQualityBonus
    );

    // Dispatch webhook (fire and forget)
    dispatchWebhook("bounty.submission_reviewed", {
      submission_id: id,
      action: parsed.data.action,
      reviewed_by: user.id,
    }).catch((err) => console.error("Webhook dispatch error:", err));

    return NextResponse.json({ submission });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err) },
      { status: 500 }
    );
  }
}
