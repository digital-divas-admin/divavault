import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOptOutSchema } from "@/lib/optout-validators";
import { getAICompany } from "@/lib/ai-companies";
import {
  generateOptOutNoticeText,
  generateOptOutNoticeHtml,
  generateOptOutSubject,
  hashContent,
} from "@/lib/optout-email";
import { sendOptOutNotice } from "@/lib/email";

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

  const parsed = sendOptOutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { company_slug } = parsed.data;

  try {
    // Get contributor info
    const { data: contributor, error: contribErr } = await supabase
      .from("contributors")
      .select("id, full_name, email")
      .eq("id", user.id)
      .single();

    if (contribErr || !contributor) {
      return NextResponse.json(
        { error: "Contributor not found" },
        { status: 404 }
      );
    }

    // Look up company
    const company = getAICompany(company_slug);
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 400 }
      );
    }

    // Only email-based opt-outs are handled here
    if (company.method === "web_form" || company.method === "account_settings") {
      return NextResponse.json(
        { error: "Use the web form or account settings to opt out" },
        { status: 400 }
      );
    }

    // Must have a contact email to send to
    if (!company.contactEmail) {
      return NextResponse.json(
        { error: "No contact email available for this company" },
        { status: 400 }
      );
    }

    // Upsert opt-out request
    const { data: optoutRequest, error: upsertErr } = await supabase
      .from("optout_requests")
      .upsert(
        {
          contributor_id: user.id,
          company_slug,
          status: "sent",
          method: company.method,
          last_sent_at: new Date().toISOString(),
        },
        { onConflict: "contributor_id,company_slug" }
      )
      .select()
      .single();

    if (upsertErr || !optoutRequest) {
      console.error("Opt-out request upsert error:", upsertErr?.message);
      return NextResponse.json(
        { error: "Failed to create opt-out request" },
        { status: 500 }
      );
    }

    // Generate notice content
    const noticeParams = {
      userName: contributor.full_name,
      companyName: company.name,
      companySlug: company.slug,
      date: new Date().toISOString(),
    };
    const text = await generateOptOutNoticeText(noticeParams);
    const html = await generateOptOutNoticeHtml(noticeParams);
    const subject = generateOptOutSubject(company.name);
    const contentHash = await hashContent(text);

    // Send the email
    const result = await sendOptOutNotice({
      to: company.contactEmail,
      subject,
      html,
      text,
    });

    // Record the communication
    const { error: commErr } = await supabase
      .from("optout_communications")
      .insert({
        request_id: optoutRequest.id,
        contributor_id: user.id,
        direction: "outbound",
        communication_type: "initial_notice",
        subject,
        content_text: text,
        content_hash: contentHash,
        template_version: "v1.0",
        recipient_email: company.contactEmail,
        resend_message_id: result?.id || null,
        sent_at: new Date().toISOString(),
      });

    if (commErr) {
      console.error("Communication insert error:", commErr.message);
      // Non-fatal: the email was already sent, so still return success
    }

    return NextResponse.json({
      success: true,
      request_id: optoutRequest.id,
      message_id: result?.id,
    });
  } catch (err) {
    console.error("Send opt-out error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
