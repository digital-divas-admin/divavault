import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  createClaimedIdentity,
  addRegistryContact,
} from "@/lib/registry";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`claim:${ip}`, 5, 3600000);
  if (limited) return limited;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const selfie = formData.get("selfie") as File | null;
  const email = formData.get("email") as string | null;

  if (!selfie || !(selfie instanceof File)) {
    return NextResponse.json(
      { error: "Selfie is required" },
      { status: 400 }
    );
  }

  // 5MB limit
  if (selfie.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Selfie must be under 5MB" },
      { status: 400 }
    );
  }

  try {
    const timestamp = Date.now();
    const tempPath = `pending/${timestamp}.jpg`;

    // Create claimed identity first to get the CID
    const identity = await createClaimedIdentity({
      selfiePath: `claim-selfies/${tempPath}`,
      metadata: { source: "free_claim" },
    });

    // Upload selfie to claim-selfies bucket using service client
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceClient();

    const arrayBuffer = await selfie.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("claim-selfies")
      .upload(`${identity.cid}/${timestamp}.jpg`, arrayBuffer, {
        contentType: selfie.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Selfie upload error:", uploadError.message);
      return NextResponse.json(
        { error: "Failed to upload selfie" },
        { status: 500 }
      );
    }

    // Add contact email if provided + send confirmation
    if (email) {
      await addRegistryContact(identity.cid, email);

      // Fire-and-forget confirmation email
      import("@/lib/email")
        .then(({ sendClaimConfirmation }) =>
          sendClaimConfirmation(email, identity.cid)
        )
        .catch((err) => console.error("Claim email error:", err));
    }

    return NextResponse.json({
      success: true,
      cid: identity.cid,
    });
  } catch (err) {
    console.error("Registry claim error:", err);
    return NextResponse.json(
      { error: "Failed to create claim" },
      { status: 500 }
    );
  }
}
