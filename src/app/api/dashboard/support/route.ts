import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/dashboard-queries";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  await logActivity(user.id, "support_request", "Submitted a support request", {
    category: body.category,
    subject: body.subject,
    message: body.message,
    type: body.type || "contact",
  });

  return NextResponse.json({ success: true });
}
