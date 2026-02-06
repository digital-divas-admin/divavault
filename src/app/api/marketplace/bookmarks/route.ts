import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { bookmarkSchema } from "@/lib/marketplace-validators";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = bookmarkSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();

  if (result.data.action === "add") {
    const { error } = await serviceClient
      .from("bounty_bookmarks")
      .upsert(
        {
          contributor_id: user.id,
          request_id: result.data.requestId,
        },
        { onConflict: "contributor_id,request_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await serviceClient
      .from("bounty_bookmarks")
      .delete()
      .eq("contributor_id", user.id)
      .eq("request_id", result.data.requestId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
