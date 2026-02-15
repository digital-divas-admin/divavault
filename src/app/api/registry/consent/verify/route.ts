import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getIdentityByContributorId,
  verifyConsentChain,
} from "@/lib/registry";

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
      return NextResponse.json(
        { error: "No registry identity found" },
        { status: 404 }
      );
    }

    const { valid, errors } = await verifyConsentChain(identity.cid);

    return NextResponse.json({
      valid,
      errors,
      event_count: errors.length === 0 ? undefined : errors.length,
    });
  } catch (err) {
    console.error("Registry consent chain verification error:", err);
    return NextResponse.json(
      { error: "Failed to verify consent chain" },
      { status: 500 }
    );
  }
}
