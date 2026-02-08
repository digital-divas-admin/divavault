import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN!;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY!;
const SUMSUB_BASE_URL = "https://api.sumsub.com";

function createSignature(
  method: string,
  url: string,
  ts: number,
  body: string = ""
): string {
  const hmac = crypto.createHmac("sha256", SUMSUB_SECRET_KEY);
  hmac.update(ts + method.toUpperCase() + url + body);
  return hmac.digest("hex");
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const externalUserId = user.id;
    const levelName = "basic-kyc-level";

    // Step 1: Create or get applicant
    const ts1 = Math.floor(Date.now() / 1000);
    const createPath = `/resources/applicants?levelName=${levelName}`;
    const createBody = JSON.stringify({ externalUserId });
    const createSig = createSignature("POST", createPath, ts1, createBody);

    const applicantRes = await fetch(`${SUMSUB_BASE_URL}${createPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Token": SUMSUB_APP_TOKEN,
        "X-App-Access-Sig": createSig,
        "X-App-Access-Ts": ts1.toString(),
      },
      body: createBody,
    });

    if (!applicantRes.ok && applicantRes.status !== 409) {
      const err = await applicantRes.text();
      console.error("SumSub create applicant error:", err);
      return NextResponse.json(
        { error: "Failed to create applicant" },
        { status: 500 }
      );
    }

    // Step 2: Generate access token for the SDK
    const ts2 = Math.floor(Date.now() / 1000);
    const tokenPath = `/resources/accessTokens?userId=${externalUserId}&levelName=${levelName}`;
    const tokenSig = createSignature("POST", tokenPath, ts2);

    const tokenRes = await fetch(`${SUMSUB_BASE_URL}${tokenPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Token": SUMSUB_APP_TOKEN,
        "X-App-Access-Sig": tokenSig,
        "X-App-Access-Ts": ts2.toString(),
      },
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("SumSub access token error:", err);
      return NextResponse.json(
        { error: "Failed to generate access token" },
        { status: 500 }
      );
    }

    const tokenData = await tokenRes.json();

    // Store applicant ID on contributor record
    await supabase
      .from("contributors")
      .update({ sumsub_applicant_id: tokenData.userId })
      .eq("id", user.id);

    return NextResponse.json({ token: tokenData.token });
  } catch (err) {
    console.error("SumSub token error:", err);
    return NextResponse.json(
      { error: "Failed to generate verification token" },
      { status: 500 }
    );
  }
}
