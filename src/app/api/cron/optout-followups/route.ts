import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAICompany } from "@/lib/ai-companies";
import {
  generateOptOutNoticeText,
  generateOptOutNoticeHtml,
  generateOptOutSubject,
  hashContent,
} from "@/lib/optout-email";
import { sendOptOutNotice } from "@/lib/email";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();

    // Find requests needing follow-up:
    // - Status is "sent" or "follow_up_sent"
    // - last_sent_at is older than 30 days (rough filter; exact check in code)
    // - follow_up_count < max_follow_ups (cap at 3 for the query)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const { data: requests, error: fetchErr } = await supabase
      .from("optout_requests")
      .select("*, contributors!inner(full_name, email)")
      .in("status", ["sent", "follow_up_sent"])
      .lt("last_sent_at", cutoffDate.toISOString())
      .lt("follow_up_count", 3);

    if (fetchErr) {
      console.error("Follow-up fetch error:", fetchErr.message);
      return NextResponse.json(
        { error: "Failed to fetch follow-up requests" },
        { status: 500 }
      );
    }

    let followedUp = 0;
    let markedUnresponsive = 0;

    for (const req of requests || []) {
      try {
        const company = getAICompany(req.company_slug);
        if (!company || !company.contactEmail) {
          continue;
        }

        // Exact check: last_sent_at + follow_up_days < now
        const lastSent = new Date(req.last_sent_at);
        const followUpDue = new Date(lastSent);
        followUpDue.setDate(followUpDue.getDate() + (req.follow_up_days || 30));

        if (followUpDue > new Date()) {
          continue; // Not yet due for follow-up
        }

        // Access the joined contributor data
        const contributor = req.contributors as {
          full_name: string;
          email: string;
        };

        // Generate follow-up notice
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

        // Send the follow-up email
        const result = await sendOptOutNotice({
          to: company.contactEmail,
          subject,
          html,
          text,
        });

        // Record the follow-up communication
        const { error: commErr } = await supabase
          .from("optout_communications")
          .insert({
            request_id: req.id,
            contributor_id: req.contributor_id,
            direction: "outbound",
            communication_type: "follow_up",
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
            `Follow-up communication insert error for ${req.company_slug}:`,
            commErr.message
          );
        }

        // Update the request
        const newFollowUpCount = (req.follow_up_count || 0) + 1;
        const isUnresponsive = newFollowUpCount >= (req.max_follow_ups || 3);

        const updateData: Record<string, unknown> = {
          follow_up_count: newFollowUpCount,
          last_sent_at: new Date().toISOString(),
          status: isUnresponsive ? "unresponsive" : "follow_up_sent",
          updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await supabase
          .from("optout_requests")
          .update(updateData)
          .eq("id", req.id);

        if (updateErr) {
          console.error(
            `Follow-up request update error for ${req.company_slug}:`,
            updateErr.message
          );
          continue;
        }

        if (isUnresponsive) {
          markedUnresponsive++;
        } else {
          followedUp++;
        }
      } catch (err) {
        console.error(`Follow-up error for request ${req.id}:`, err);
        // Continue with remaining requests
      }
    }

    return NextResponse.json({
      processed: (requests || []).length,
      followed_up: followedUp,
      marked_unresponsive: markedUnresponsive,
    });
  } catch (err) {
    console.error("Cron follow-up error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
