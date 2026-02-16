import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordResponseSchema } from "@/lib/optout-validators";
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

  const parsed = recordResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { request_id, response_text, communication_type } = parsed.data;

  try {
    // Verify the request belongs to this user
    const { data: optoutRequest, error: fetchErr } = await supabase
      .from("optout_requests")
      .select("*")
      .eq("id", request_id)
      .eq("contributor_id", user.id)
      .single();

    if (fetchErr || !optoutRequest) {
      return NextResponse.json(
        { error: "Opt-out request not found" },
        { status: 404 }
      );
    }

    // Hash the response content
    const contentHash = await hashContent(response_text);

    // Insert inbound communication record
    const { error: commErr } = await supabase
      .from("optout_communications")
      .insert({
        request_id,
        contributor_id: user.id,
        direction: "inbound",
        communication_type,
        content_text: response_text,
        content_hash: contentHash,
      });

    if (commErr) {
      console.error("Response communication insert error:", commErr.message);
      return NextResponse.json(
        { error: "Failed to record response" },
        { status: 500 }
      );
    }

    // Update request status based on communication type
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (communication_type === "confirmation") {
      updateData.status = "confirmed";
      updateData.confirmed_at = new Date().toISOString();
    } else if (communication_type === "denial") {
      updateData.status = "denied";
    }
    // For "response" type, leave status as-is

    const { error: updateErr } = await supabase
      .from("optout_requests")
      .update(updateData)
      .eq("id", request_id)
      .eq("contributor_id", user.id);

    if (updateErr) {
      console.error("Request status update error:", updateErr.message);
      // Non-fatal: the communication was already recorded
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Record response error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
