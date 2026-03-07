import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { getTasksForInvestigation } from "@/lib/investigation-queries";
import { TASK_STALE_MS } from "@/lib/investigation-utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const tasks = await getTasksForInvestigation(id);

    // Auto-fail stale pending/running tasks
    const cutoff = new Date(Date.now() - TASK_STALE_MS).toISOString();
    const staleMsg = `Task timed out (stale after ${TASK_STALE_MS / 60000} minutes)`;
    const stale = tasks.filter(
      (t) =>
        (t.status === "pending" || t.status === "running") &&
        t.created_at < cutoff
    );

    if (stale.length > 0) {
      const service = await createServiceClient();
      await service
        .from("deepfake_tasks")
        .update({
          status: "failed",
          error_message: staleMsg,
          completed_at: new Date().toISOString(),
        })
        .in(
          "id",
          stale.map((t) => t.id)
        );

      for (const t of stale) {
        t.status = "failed";
        t.error_message = staleMsg;
      }
    }

    return NextResponse.json(tasks);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
