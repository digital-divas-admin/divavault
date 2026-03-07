import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendInquiryAlert, sendInquiryConfirmation } from "@/lib/email";
import { logApiError } from "@/lib/api-logger";

const inquirySchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Invalid email" }),
  phone: z.string().optional(),
  company: z.string().optional(),
  case_type: z.enum(
    ["litigation", "takedown_escalation", "proactive_protection", "other"],
    { message: "Invalid case type" }
  ),
  message: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    const { error } = await supabase
      .from("case_inquiries")
      .insert(parsed.data);

    if (error) {
      logApiError("POST", "/api/inquiries", "insert inquiry", error);
      return NextResponse.json(
        { error: "Failed to submit inquiry" },
        { status: 500 }
      );
    }

    // Send emails (awaited so they complete before the response closes the execution context)
    await Promise.all([
      sendInquiryAlert(parsed.data).catch((err) =>
        logApiError("POST", "/api/inquiries", "alert email", err)
      ),
      sendInquiryConfirmation(parsed.data).catch((err) =>
        logApiError("POST", "/api/inquiries", "confirmation email", err)
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
