import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/dashboard-queries";
import { z } from "zod";

const supportSchema = z.object({
  category: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  type: z.string().max(50).optional(),
});

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

  const parsed = supportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  await logActivity(user.id, "support_request", "Submitted a support request", {
    category: parsed.data.category,
    subject: parsed.data.subject,
    message: parsed.data.message,
    type: parsed.data.type || "contact",
  });

  return NextResponse.json({ success: true });
}
