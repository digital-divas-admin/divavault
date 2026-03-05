"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Trash2,
  Play,
  Brain,
  Search,
  ImageIcon,
  FileCheck,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface DatasetStatus {
  realCount: number;
  aiCount: number;
  modelExists: boolean;
  realImages: string[];
  aiImages: string[];
}

type OperationResult = {
  success: boolean;
  output: string;
  error?: string;
};

export function ClipDetectorDashboard() {
  const [status, setStatus] = useState<DatasetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"real" | "ai" | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [checkFile, setCheckFile] = useState<File | null>(null);
  const [showRealImages, setShowRealImages] = useState(false);
  const [showAiImages, setShowAiImages] = useState(false);
  const realInputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const checkInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/clip-detector");
      if (res.ok) {
        setStatus(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpload = async (label: "real" | "ai", files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(label);
    try {
      const formData = new FormData();
      formData.append("label", label);
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch("/api/admin/clip-detector", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ success: true, output: `Uploaded ${data.count} ${label} image(s)` });
      }
      await fetchStatus();
    } finally {
      setUploading(null);
    }
  };

  const handleAction = async (action: string) => {
    setRunning(action);
    setResult(null);
    try {
      const res = await fetch("/api/admin/clip-detector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setResult(data);
      if (action === "train") await fetchStatus();
    } finally {
      setRunning(null);
    }
  };

  const handleCheckImage = async () => {
    if (!checkFile) return;
    setRunning("check");
    setResult(null);
    try {
      // Upload to a temp location first, then check
      const formData = new FormData();
      formData.append("label", "real"); // temp upload
      formData.append("files", checkFile);
      const uploadRes = await fetch("/api/admin/clip-detector", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) return;
      const uploadData = await uploadRes.json();
      const fileName = uploadData.uploaded[0];

      // Now check it
      const res = await fetch("/api/admin/clip-detector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check",
          imagePath: `./data/real/${fileName}`,
        }),
      });
      const data = await res.json();
      setResult(data);

      // Clean up the temp file
      await fetch("/api/admin/clip-detector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_image", fileName, label: "real" }),
      });
      await fetchStatus();
    } finally {
      setRunning(null);
      setCheckFile(null);
      if (checkInputRef.current) checkInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async (fileName: string, label: "real" | "ai") => {
    await fetch("/api/admin/clip-detector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_image", fileName, label }),
    });
    await fetchStatus();
  };

  const handleClearDataset = async (label: "real" | "ai") => {
    await fetch("/api/admin/clip-detector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_dataset", label }),
    });
    await fetchStatus();
  };

  const parsedResult = result ? parseOutput(result.output) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Real Images"
          value={status?.realCount ?? 0}
          icon={<ImageIcon className="h-4 w-4 text-green-500" />}
        />
        <StatCard
          label="AI Images"
          value={status?.aiCount ?? 0}
          icon={<ImageIcon className="h-4 w-4 text-red-500" />}
        />
        <StatCard
          label="Total Dataset"
          value={(status?.realCount ?? 0) + (status?.aiCount ?? 0)}
          icon={<FileCheck className="h-4 w-4 text-muted-foreground" />}
        />
        <div className="bg-card rounded-xl border border-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Model</span>
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <Badge variant={status?.modelExists ? "success" : "warning"}>
            {status?.modelExists ? "Trained" : "Not trained"}
          </Badge>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Dataset Management */}
        <div className="space-y-4">
          {/* Real Images Upload */}
          <DatasetPanel
            label="Real Images"
            description="Authentic photographs for training"
            count={status?.realCount ?? 0}
            images={status?.realImages ?? []}
            badgeVariant="success"
            uploading={uploading === "real"}
            showImages={showRealImages}
            onToggleImages={() => setShowRealImages(!showRealImages)}
            onUploadClick={() => realInputRef.current?.click()}
            onClear={() => handleClearDataset("real")}
            onDeleteImage={(name) => handleDeleteImage(name, "real")}
          />
          <input
            ref={realInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload("real", e.target.files)}
          />

          {/* AI Images Upload */}
          <DatasetPanel
            label="AI-Generated Images"
            description="AI/synthetic images for training"
            count={status?.aiCount ?? 0}
            images={status?.aiImages ?? []}
            badgeVariant="destructive"
            uploading={uploading === "ai"}
            showImages={showAiImages}
            onToggleImages={() => setShowAiImages(!showAiImages)}
            onUploadClick={() => aiInputRef.current?.click()}
            onClear={() => handleClearDataset("ai")}
            onDeleteImage={(name) => handleDeleteImage(name, "ai")}
          />
          <input
            ref={aiInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload("ai", e.target.files)}
          />
        </div>

        {/* Right: Operations */}
        <div className="space-y-4">
          {/* Quick Test */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Quick Test</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Leave-one-out SVM validation on your dataset
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  running !== null ||
                  (status?.realCount ?? 0) < 2 ||
                  (status?.aiCount ?? 0) < 2
                }
                onClick={() => handleAction("quick_test")}
              >
                {running === "quick_test" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run
              </Button>
            </div>
            {(status?.realCount ?? 0) < 2 || (status?.aiCount ?? 0) < 2 ? (
              <p className="text-xs text-muted-foreground">
                Need at least 2 images in each category
              </p>
            ) : null}
          </div>

          {/* Train Model */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Train Detector</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Train CLIP + SVM with cross-validation
                </p>
              </div>
              <Button
                size="sm"
                disabled={
                  running !== null ||
                  (status?.realCount ?? 0) < 3 ||
                  (status?.aiCount ?? 0) < 3
                }
                onClick={() => handleAction("train")}
              >
                {running === "train" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                Train
              </Button>
            </div>
            {(status?.realCount ?? 0) < 3 || (status?.aiCount ?? 0) < 3 ? (
              <p className="text-xs text-muted-foreground">
                Need at least 3 images in each category
              </p>
            ) : null}
          </div>

          {/* Check Single Image */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
            <div>
              <h3 className="text-sm font-medium">Check Image</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Classify a single image using the trained model
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => checkInputRef.current?.click()}
                disabled={!status?.modelExists || running !== null}
              >
                <Upload className="h-4 w-4" />
                Select Image
              </Button>
              {checkFile && (
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {checkFile.name}
                </span>
              )}
              {checkFile && (
                <Button
                  size="sm"
                  disabled={running !== null}
                  onClick={handleCheckImage}
                >
                  {running === "check" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Analyze
                </Button>
              )}
            </div>
            <input
              ref={checkInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setCheckFile(e.target.files[0]);
              }}
            />
            {!status?.modelExists && (
              <p className="text-xs text-muted-foreground">
                Train a model first before checking images
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Parsed Summary */}
          {parsedResult && (
            <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Results</h3>
                {parsedResult.verdict && (
                  <Badge
                    variant={
                      parsedResult.verdict === "STRONG"
                        ? "success"
                        : parsedResult.verdict === "MODERATE"
                          ? "warning"
                          : "destructive"
                    }
                  >
                    {parsedResult.verdict} DETECTION
                  </Badge>
                )}
                {parsedResult.classification && (
                  <Badge
                    variant={
                      parsedResult.classification === "AI-GENERATED"
                        ? "destructive"
                        : "success"
                    }
                  >
                    {parsedResult.classification}
                  </Badge>
                )}
              </div>

              {/* Metrics row */}
              {(parsedResult.accuracy !== undefined ||
                parsedResult.confidence !== undefined ||
                parsedResult.cvAccuracy !== undefined) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {parsedResult.accuracy !== undefined && (
                    <MetricCard label="Accuracy" value={`${(parsedResult.accuracy * 100).toFixed(1)}%`} />
                  )}
                  {parsedResult.cvAccuracy !== undefined && (
                    <MetricCard label="CV Accuracy" value={`${(parsedResult.cvAccuracy * 100).toFixed(1)}%`} />
                  )}
                  {parsedResult.separationScore !== undefined && (
                    <MetricCard label="Separation" value={parsedResult.separationScore.toFixed(4)} />
                  )}
                  {parsedResult.centroidSimilarity !== undefined && (
                    <MetricCard label="Centroid Sim." value={parsedResult.centroidSimilarity.toFixed(4)} />
                  )}
                  {parsedResult.pAi !== undefined && (
                    <MetricCard label="P(AI)" value={`${(parsedResult.pAi * 100).toFixed(1)}%`} />
                  )}
                  {parsedResult.pReal !== undefined && (
                    <MetricCard label="P(Real)" value={`${(parsedResult.pReal * 100).toFixed(1)}%`} />
                  )}
                  {parsedResult.confidence !== undefined && (
                    <MetricCard label="Confidence" value={`${(parsedResult.confidence * 100).toFixed(1)}%`} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Raw Output */}
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Output
              </h3>
              {result.error && (
                <Badge variant="destructive" className="text-xs">Error</Badge>
              )}
            </div>
            <pre className="p-4 text-xs text-muted-foreground font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
              {result.output}
              {result.error && (
                <span className="text-red-400">{"\n"}{result.error}</span>
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function DatasetPanel({
  label,
  description,
  count,
  images,
  badgeVariant,
  uploading,
  showImages,
  onToggleImages,
  onUploadClick,
  onClear,
  onDeleteImage,
}: {
  label: string;
  description: string;
  count: number;
  images: string[];
  badgeVariant: "success" | "destructive";
  uploading: boolean;
  showImages: boolean;
  onToggleImages: () => void;
  onUploadClick: () => void;
  onClear: () => void;
  onDeleteImage: (name: string) => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{label}</h3>
            <Badge variant={badgeVariant} className="text-xs">
              {count}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onUploadClick}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload
          </Button>
          {count > 0 && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onClear}
              title="Clear all"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {count > 0 && (
        <button
          onClick={onToggleImages}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showImages ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showImages ? "Hide" : "Show"} files
        </button>
      )}

      {showImages && images.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {images.map((name) => (
            <div
              key={name}
              className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/30 group"
            >
              <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                {name}
              </span>
              <button
                onClick={() => onDeleteImage(name)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Parse key metrics from Python script output
function parseOutput(output: string): {
  accuracy?: number;
  cvAccuracy?: number;
  separationScore?: number;
  centroidSimilarity?: number;
  verdict?: "STRONG" | "MODERATE" | "WEAK" | "NO";
  classification?: string;
  confidence?: number;
  pAi?: number;
  pReal?: number;
} | null {
  if (!output) return null;

  const result: ReturnType<typeof parseOutput> = {};

  // Quick test output parsing
  const accMatch = output.match(/Accuracy:\s*([\d.]+%?)\s/);
  if (accMatch) {
    const val = accMatch[1];
    result.accuracy = val.includes("%")
      ? parseFloat(val) / 100
      : parseFloat(val);
  }

  const cvMatch = output.match(/CV Accuracy:\s*([\d.]+)/);
  if (cvMatch) {
    result.cvAccuracy = parseFloat(cvMatch[1]);
  }

  const sepMatch = output.match(/Separation score:\s*([\d.-]+)/);
  if (sepMatch) {
    result.separationScore = parseFloat(sepMatch[1]);
  }

  const centMatch = output.match(/Centroid cosine similarity:\s*([\d.]+)/);
  if (centMatch) {
    result.centroidSimilarity = parseFloat(centMatch[1]);
  }

  if (output.includes("STRONG DETECTION")) result.verdict = "STRONG";
  else if (output.includes("MODERATE DETECTION")) result.verdict = "MODERATE";
  else if (output.includes("WEAK DETECTION")) result.verdict = "WEAK";
  else if (output.includes("NO DETECTION")) result.verdict = "NO";

  // Check image output parsing
  const classMatch = output.match(/Classification:\s*([\w-]+)/);
  if (classMatch) result.classification = classMatch[1];

  const confMatch = output.match(/Confidence:\s*([\d.]+%?)/);
  if (confMatch) {
    const val = confMatch[1];
    result.confidence = val.includes("%")
      ? parseFloat(val) / 100
      : parseFloat(val);
  }

  const pAiMatch = output.match(/P\(AI\):\s*([\d.]+)/);
  if (pAiMatch) result.pAi = parseFloat(pAiMatch[1]);

  const pRealMatch = output.match(/P\(real\):\s*([\d.]+)/);
  if (pRealMatch) result.pReal = parseFloat(pRealMatch[1]);

  return Object.keys(result).length > 0 ? result : null;
}
