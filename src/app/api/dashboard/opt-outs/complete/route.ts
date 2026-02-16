import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeOptOutSchema } from "@/lib/optout-validators";
import { getAICompany } from "@/lib/ai-companies";
import { hashContent } from "@/lib/optout-email";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = completeOptOutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { company_slug, notes } = parsed.data;

  try {
    // Look up company
    const company = getAICompany(company_slug);
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 400 }
      );
    }

    // Determine completion status based on method
    const status =
      company.method === "web_form" ? "completed_web" : "completed_settings";

    // Upsert request with completion status
    const { data: optoutRequest, error: upsertErr } = await supabase
      .from("optout_requests")
      .upsert(
        {
          contributor_id: user.id,
          company_slug,
          status,
          method: company.method,
          confirmed_at: new Date().toISOString(),
          notes: notes || null,
        },
        { onConflict: "contributor_id,company_slug" }
      )
      .select()
      .single();

    if (upsertErr || !optoutRequest) {
      console.error("Complete opt-out upsert error:", upsertErr?.message);
      return NextResponse.json(
        { error: "Failed to update opt-out request" },
        { status: 500 }
      );
    }

    // Record completion communication
    const contentText = `Opted out via ${company.method === "web_form" ? "web form" : "account settings"} on ${company.name}`;
    const contentHash = await hashContent(contentText);

    const { error: commErr } = await supabase
      .from("optout_communications")
      .insert({
        request_id: optoutRequest.id,
        contributor_id: user.id,
        direction: "outbound",
        communication_type: "confirmation",
        content_text: contentText,
        content_hash: contentHash,
        sent_at: new Date().toISOString(),
      });

    if (commErr) {
      console.error("Complete communication insert error:", commErr.message);
      // Non-fatal
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Complete opt-out error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
