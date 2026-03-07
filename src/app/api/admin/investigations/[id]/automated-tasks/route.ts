import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { triggerAutomatedSearchSchema } from "@/lib/investigation-validators";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = triggerAutomatedSearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { task_types, frame_ids } = parsed.data;
    const service = await createServiceClient();
    const createdTasks: Array<{ id: string; task_type: string }> = [];

    // Resolve frame IDs once for all per-frame task types
    const needsFrames = task_types.some((t) => t === "reverse_search" || t === "ai_detection" || t === "visual_search");
    let targetFrameIds: string[] = [];
    if (needsFrames) {
      targetFrameIds = frame_ids || [];
      if (targetFrameIds.length === 0) {
        const { data: keyFrames } = await service
          .from("deepfake_frames")
          .select("id")
          .eq("investigation_id", id)
          .eq("is_key_evidence", true);
        targetFrameIds = (keyFrames || []).map((f: { id: string }) => f.id);
      }
      if (targetFrameIds.length === 0) {
        const { data: allFrames } = await service
          .from("deepfake_frames")
          .select("id")
          .eq("investigation_id", id)
          .limit(10);
        targetFrameIds = (allFrames || []).map((f: { id: string }) => f.id);
      }
    }

    // For AI detection, only sample a few spread-out frames to save API calls.
    // If a few frames are AI-generated, the whole video is.
    const AI_DETECTION_SAMPLE = 3;
    let aiDetectionFrameIds = targetFrameIds;
    if (targetFrameIds.length > AI_DETECTION_SAMPLE) {
      const step = (targetFrameIds.length - 1) / (AI_DETECTION_SAMPLE - 1);
      aiDetectionFrameIds = Array.from({ length: AI_DETECTION_SAMPLE }, (_, i) =>
        targetFrameIds[Math.round(i * step)]
      );
    }

    for (const taskType of task_types) {
      if (taskType === "reverse_search" || taskType === "ai_detection" || taskType === "visual_search") {
        const frameIds = (taskType === "ai_detection" || taskType === "visual_search") ? aiDetectionFrameIds : targetFrameIds;
        if (frameIds.length > 0) {
          const rows = frameIds.map((frameId) => ({
            investigation_id: id,
            task_type: taskType,
            frame_id: frameId,
          }));
          const { data, error } = await service
            .from("deepfake_tasks")
            .insert(rows)
            .select("id, task_type");
          if (error) throw error;
          if (data) createdTasks.push(...data);
        }
      } else if (taskType === "check_provenance") {
        const { data: media } = await service
          .from("deepfake_media")
          .select("id")
          .eq("investigation_id", id)
          .eq("download_status", "completed");

        if (media && media.length > 0) {
          const rows = media.map((m: { id: string }) => ({
            investigation_id: id,
            media_id: m.id,
            task_type: taskType,
          }));
          const { data, error } = await service
            .from("deepfake_tasks")
            .insert(rows)
            .select("id, task_type");
          if (error) throw error;
          if (data) createdTasks.push(...data);
        }
      } else if (taskType === "news_search" || taskType === "wire_search") {
        const { data, error } = await service
          .from("deepfake_tasks")
          .insert({
            investigation_id: id,
            task_type: taskType,
          })
          .select("id, task_type")
          .single();
        if (error) throw error;
        if (data) createdTasks.push(data);
      }
    }

    // Fire-and-forget: trigger scanner only for tasks that need it
    const scannerTaskTypes = ["reverse_search", "check_provenance"];
    if (createdTasks.some(t => scannerTaskTypes.includes(t.task_type))) {
      const scannerUrl = process.env.SCANNER_SERVICE_URL || "http://localhost:8000";
      fetch(`${scannerUrl}/admin/deepfake/process`, {
        method: "POST",
        headers: { "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY || "" },
      }).catch((err) => console.error("Failed to trigger scanner:", err));
    }

    // Fire-and-forget: process background tasks with literal imports for bundler analysis
    const created = new Set(createdTasks.map(t => t.task_type));

    if (created.has("ai_detection")) {
      import("@/lib/hive-ai").then(({ processAiDetectionTasks }) =>
        processAiDetectionTasks(id).catch((err) => console.error("[automated-tasks] ai_detection error:", err))
      );
    }
    if (created.has("visual_search")) {
      import("@/lib/visual-search").then(({ processVisualSearchTasks }) =>
        processVisualSearchTasks(id).catch((err) => console.error("[automated-tasks] visual_search error:", err))
      );
    }
    if (created.has("wire_search")) {
      import("@/lib/wire-search").then(({ processWireSearchTask }) =>
        processWireSearchTask(id).catch((err) => console.error("[automated-tasks] wire_search error:", err))
      );
    }
    if (created.has("news_search")) {
      import("@/lib/news-search").then(({ processNewsSearchTask }) =>
        processNewsSearchTask(id).catch((err) => console.error("[automated-tasks] news_search error:", err))
      );
    }

    return NextResponse.json({ tasks: createdTasks }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
