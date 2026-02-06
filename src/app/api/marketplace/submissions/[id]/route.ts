import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { submitSubmissionSchema } from "@/lib/marketplace-validators";

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = submitSubmissionSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  // Verify ownership
  const { data: submission } = await supabase
    .from("bounty_submissions")
    .select("*")
    .eq("id", id)
    .eq("contributor_id", user.id)
    .single();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const serviceClient = await createServiceClient();

  if (result.data.action === "submit") {
    if (submission.status !== "draft" && submission.status !== "revision_requested") {
      return NextResponse.json(
        { error: "Can only submit from draft or revision_requested status" },
        { status: 400 }
      );
    }

    const { error } = await serviceClient
      .from("bounty_submissions")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        revision_count:
          submission.status === "revision_requested"
            ? submission.revision_count + 1
            : submission.revision_count,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (result.data.action === "withdraw") {
    if (
      submission.status !== "draft" &&
      submission.status !== "submitted" &&
      submission.status !== "revision_requested"
    ) {
      return NextResponse.json(
        { error: "Cannot withdraw at this stage" },
        { status: 400 }
      );
    }

    const { error } = await serviceClient
      .from("bounty_submissions")
      .update({
        status: "withdrawn",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
