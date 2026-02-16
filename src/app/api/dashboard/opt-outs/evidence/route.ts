import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const communicationId = formData.get("communication_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    if (!communicationId) {
      return NextResponse.json(
        { error: "communication_id is required" },
        { status: 400 }
      );
    }

    // Verify the communication belongs to this user
    const { data: communication, error: fetchErr } = await supabase
      .from("optout_communications")
      .select("id")
      .eq("id", communicationId)
      .eq("contributor_id", user.id)
      .single();

    if (fetchErr || !communication) {
      return NextResponse.json(
        { error: "Communication not found" },
        { status: 404 }
      );
    }

    // Hash the file content
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Upload to storage
    const filePath = `${user.id}/${communicationId}-${Date.now()}`;
    const { error: uploadErr } = await supabase.storage
      .from("optout-evidence")
      .upload(filePath, file);

    if (uploadErr) {
      console.error("Evidence upload error:", uploadErr.message);
      return NextResponse.json(
        { error: "Failed to upload evidence file" },
        { status: 500 }
      );
    }

    // Update the communication record with file path and hash
    const { error: updateErr } = await supabase
      .from("optout_communications")
      .update({
        evidence_file_path: filePath,
        evidence_file_hash: fileHash,
      })
      .eq("id", communicationId)
      .eq("contributor_id", user.id);

    if (updateErr) {
      console.error("Evidence record update error:", updateErr.message);
      return NextResponse.json(
        { error: "Failed to update communication record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      file_path: filePath,
    });
  } catch (err) {
    console.error("Evidence upload error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
