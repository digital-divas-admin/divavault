import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIdentityByContributorId, getCurrentConsent } from "@/lib/registry";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const identity = await getIdentityByContributorId(user.id);

    if (!identity) {
      return NextResponse.json({ identity: null });
    }

    const consent = await getCurrentConsent(identity.cid);

    return NextResponse.json({ identity, consent });
  } catch (err) {
    console.error("Registry identity lookup error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve registry identity" },
      { status: 500 }
    );
  }
}
