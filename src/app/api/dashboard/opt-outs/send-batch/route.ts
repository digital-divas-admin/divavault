import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AI_COMPANIES } from "@/lib/ai-companies";
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

    // Fetch existing opt-out requests for this user
    const { data: existingRequests, error: fetchErr } = await supabase
      .from("optout_requests")
      .select("company_slug, status")
      .eq("contributor_id", user.id);

    if (fetchErr) {
      console.error("Fetch existing requests error:", fetchErr.message);
      return NextResponse.json(
        { error: "Failed to fetch existing requests" },
        { status: 500 }
      );
    }

    // Build set of already-contacted company slugs (status != "not_started")
    const alreadyContacted = new Set(
      (existingRequests || [])
        .filter((r) => r.status !== "not_started")
        .map((r) => r.company_slug)
    );

    // Filter to eligible companies: email-based with a contact email, not yet contacted
    const eligibleCompanies = AI_COMPANIES.filter(
      (c) =>
        (c.method === "email" || c.method === "none") &&
        c.contactEmail &&
        !alreadyContacted.has(c.slug)
    );

    const sentCompanies: string[] = [];

    for (const company of eligibleCompanies) {
      try {
        // Rate limit: 600ms between sends
        if (sentCompanies.length > 0) {
          await new Promise((r) => setTimeout(r, 600));
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
          to: company.contactEmail!,
          subject,
          html,
          text,
        });

        // Upsert opt-out request
        const { data: optoutRequest, error: upsertErr } = await supabase
          .from("optout_requests")
          .upsert(
            {
              contributor_id: user.id,
              company_slug: company.slug,
              status: "sent",
              method: company.method,
              last_sent_at: new Date().toISOString(),
            },
            { onConflict: "contributor_id,company_slug" }
          )
          .select()
          .single();

        if (upsertErr || !optoutRequest) {
          console.error(
            `Batch opt-out upsert error for ${company.slug}:`,
            upsertErr?.message
          );
          continue;
        }

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
          console.error(
            `Batch communication insert error for ${company.slug}:`,
            commErr.message
          );
        }

        sentCompanies.push(company.slug);
      } catch (err) {
        console.error(`Batch send error for ${company.slug}:`, err);
        // Continue with remaining companies
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCompanies.length,
      companies: sentCompanies,
    });
  } catch (err) {
    console.error("Batch opt-out error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
