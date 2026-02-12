import { createClient } from "@/lib/supabase/server";

export interface CoverageSlotData {
  id: string;
  captureStep: string;
  signedUrl: string;
  qualityScore: number | null;
  createdAt: string;
}

export type CoverageMap = Partial<Record<string, CoverageSlotData>>;

export async function getCoverageImages(userId: string): Promise<CoverageMap> {
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("contributor_images")
    .select("id, capture_step, file_path, bucket, quality_score, created_at")
    .eq("contributor_id", userId)
    .order("created_at", { ascending: false });

  if (!images || images.length === 0) return {};

  // Pick the most recent image per capture_step
  const latestPerStep = new Map<string, (typeof images)[number]>();
  for (const img of images) {
    if (!latestPerStep.has(img.capture_step)) {
      latestPerStep.set(img.capture_step, img);
    }
  }

  // Generate signed URLs
  const entries = Array.from(latestPerStep.entries());
  const results = await Promise.allSettled(
    entries.map(async ([step, img]) => {
      const { data } = await supabase.storage
        .from(img.bucket)
        .createSignedUrl(img.file_path, 3600);

      const slot: CoverageSlotData = {
        id: img.id,
        captureStep: step,
        signedUrl: data?.signedUrl || "",
        qualityScore: img.quality_score,
        createdAt: img.created_at,
      };
      return [step, slot] as const;
    })
  );

  const coverageMap: CoverageMap = {};
  for (const result of results) {
    if (result.status === "fulfilled" && result.value[1].signedUrl) {
      coverageMap[result.value[0]] = result.value[1];
    }
  }

  return coverageMap;
}
