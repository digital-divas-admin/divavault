import { ClipDetectorDashboard } from "@/components/admin/investigations/clip-detector-dashboard";

export const dynamic = "force-dynamic";

export default function ClipDetectorPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">CLIP Detector</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Prototype AI image detection using CLIP ViT-L/14 features + SVM classifier
        </p>
      </div>
      <ClipDetectorDashboard />
    </div>
  );
}
