"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, ImageIcon, AlertCircle } from "lucide-react";

interface SubmissionUploadProps {
  submissionId: string;
  minWidth: number;
  minHeight: number;
  acceptedFormats: string[];
  maxFileSizeBytes: number;
  onImagesUploaded: (
    images: Array<{
      filePath: string;
      bucket: string;
      fileSize: number;
      localUrl: string;
    }>
  ) => void;
}

export function SubmissionUpload({
  submissionId,
  minWidth,
  minHeight,
  acceptedFormats,
  maxFileSizeBytes,
  onImagesUploaded,
}: SubmissionUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const bucket = "bounty-submissions";
  const acceptStr = acceptedFormats
    .map((f) => (f === "image/jpeg" ? ".jpg,.jpeg" : `.${f.split("/")[1]}`))
    .join(",");

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      setError(null);

      // Validate formats
      const invalid = fileArray.filter(
        (f) => !acceptedFormats.includes(f.type)
      );
      if (invalid.length > 0) {
        setError(
          `Only ${acceptedFormats.map((f) => f.split("/")[1]?.toUpperCase()).join(" and ")} files are accepted.`
        );
        return;
      }

      // Validate size
      const tooLarge = fileArray.filter((f) => f.size > maxFileSizeBytes);
      if (tooLarge.length > 0) {
        setError(
          `Some files exceed the ${(maxFileSizeBytes / (1024 * 1024)).toFixed(0)}MB limit.`
        );
        return;
      }

      setUploading(true);
      setProgress(0);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Your session expired. Please log in again.");
        setUploading(false);
        return;
      }

      const uploaded: Array<{
        filePath: string;
        bucket: string;
        fileSize: number;
        localUrl: string;
      }> = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const ext = file.name.split(".").pop();
        const filePath = `${user.id}/${submissionId}/${Date.now()}-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          setError(`Failed to upload ${file.name}. Other uploads are safe.`);
          continue;
        }

        uploaded.push({
          filePath,
          bucket,
          fileSize: file.size,
          localUrl: URL.createObjectURL(file),
        });
        setProgress(Math.round(((i + 1) / fileArray.length) * 100));
      }

      if (uploaded.length > 0) {
        onImagesUploaded(uploaded);
      }

      setUploading(false);
      setProgress(0);
    },
    [acceptedFormats, maxFileSizeBytes, submissionId, onImagesUploaded]
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
          onClick={() =>
            document.getElementById("submission-file-input")?.click()
          }
        >
          <input
            id="submission-file-input"
            type="file"
            multiple
            accept={acceptStr}
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
                Upload your photos for this request
              </p>
              <p className="text-xs text-muted-foreground">
                {minWidth}x{minHeight}px minimum, JPG or PNG.
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
