"use client";

import { useCallback, useState } from "react";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, ImageIcon, AlertCircle } from "lucide-react";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];

export function PhotoUpload() {
  const { trackType, addUploadedPhotos } = useOnboardingStore();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const bucket = trackType === "nsfw" ? "nsfw-uploads" : "sfw-uploads";

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      setError(null);

      // Validate files
      const invalid = fileArray.filter(
        (f) => !ACCEPTED_TYPES.includes(f.type)
      );
      if (invalid.length > 0) {
        setError("Heads up — we can only accept JPG and PNG files. Other formats won't work for AI training.");
        return;
      }

      const tooLarge = fileArray.filter((f) => f.size > MAX_FILE_SIZE);
      if (tooLarge.length > 0) {
        setError("Some of those files are over 20MB. Try resizing them, or choose smaller files.");
        return;
      }

      setUploading(true);
      setProgress(0);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Your session expired. Please log in again — don't worry, your progress is saved.");
        setUploading(false);
        return;
      }

      const uploaded: string[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const ext = file.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          setError(`Couldn't upload ${file.name} — this sometimes happens with large batches. The rest of your uploads are safe.`);
          continue;
        }

        uploaded.push(filePath);
        setProgress(Math.round(((i + 1) / fileArray.length) * 100));
      }

      if (uploaded.length > 0) {
        addUploadedPhotos(uploaded);
      }

      setUploading(false);
      setProgress(0);
    },
    [bucket, addUploadedPhotos]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  }

  return (
    <Card className="border-border/50 bg-card/50 rounded-xl">
      <CardContent className="p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-5 sm:p-8 text-center transition-colors cursor-pointer
            ${
              dragOver
                ? "border-neon bg-neon/5"
                : "border-border/50 hover:border-border"
            }`}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            multiple
            accept=".jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileInput}
          />

          {uploading ? (
            <>
              <Upload className="w-8 h-8 text-neon mx-auto mb-3 animate-pulse" />
              <p className="text-sm font-medium mb-2">Uploading...</p>
              <Progress value={progress} className="max-w-xs mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">
                {progress}% complete
              </p>
            </>
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">
                Drag & drop your photos here
              </p>
              <p className="text-xs text-muted-foreground">
                or click to choose files. JPG and PNG only, up to 20MB each.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Check the photo guidelines above for tips on what works best.
              </p>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
