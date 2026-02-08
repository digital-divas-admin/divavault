"use client";

import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";

export interface CameraViewHandle {
  captureFrame: () => Blob | null;
  getCanvas: () => HTMLCanvasElement | null;
  getVideoSize: () => { width: number; height: number };
}

interface CameraViewProps {
  onReady?: () => void;
  onError?: (error: string) => void;
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(
  function CameraView({ onReady, onError }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [started, setStarted] = useState(false);

    useImperativeHandle(ref, () => ({
      captureFrame: () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return null;

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        // Convert to JPEG blob
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const bytes = atob(dataUrl.split(",")[1]);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          arr[i] = bytes.charCodeAt(i);
        }
        return new Blob([arr], { type: "image/jpeg" });
      },
      getCanvas: () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return null;

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        return canvas;
      },
      getVideoSize: () => {
        const video = videoRef.current;
        return {
          width: video?.videoWidth || 0,
          height: video?.videoHeight || 0,
        };
      },
    }));

    useEffect(() => {
      async function startCamera() {
        // getUserMedia requires HTTPS (or localhost). Check before calling.
        if (!navigator.mediaDevices?.getUserMedia) {
          onError?.(
            "Camera requires a secure connection (HTTPS). Please use HTTPS or localhost."
          );
          return;
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });

          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setStarted(true);
            onReady?.();
          }
        } catch (err) {
          console.error("Camera access error:", err);
          const isDenied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
          if (isDenied) {
            onError?.(
              "Camera access was denied. To re-enable: open your browser settings, find camera permissions for this site, and set it to Allow. Then reload this page."
            );
          } else {
            onError?.(
              "Could not access camera. Make sure no other app is using it, then try again."
            );
          }
        }
      }

      startCamera();

      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };
    }, [onReady, onError]);

    return (
      <div className="relative w-full aspect-[3/4] max-h-[60vh] bg-black rounded-2xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover mirror"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} className="hidden" />
        {!started && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/60 text-sm">Starting camera...</p>
          </div>
        )}
      </div>
    );
  }
);
