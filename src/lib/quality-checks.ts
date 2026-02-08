import type { QualityCheckResult, QualityCheckType } from "@/types/capture";

// Brightness analysis using canvas pixel data
function checkBrightness(imageData: ImageData): QualityCheckResult {
  const data = imageData.data;
  let totalBrightness = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    // Luminance formula
    totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const avgBrightness = totalBrightness / pixelCount;
  const normalized = avgBrightness / 255;
  const passed = normalized > 0.2 && normalized < 0.85;

  let message = "Lighting looks good";
  if (normalized <= 0.2) message = "Too dark — move to a brighter area";
  if (normalized >= 0.85) message = "Too bright — avoid direct light";

  return {
    type: "brightness",
    passed,
    value: normalized,
    threshold: 0.2,
    message,
  };
}

// Sharpness estimation using Laplacian variance
function checkSharpness(imageData: ImageData, width: number, height: number): QualityCheckResult {
  const gray = new Float32Array(width * height);
  const data = imageData.data;

  // Convert to grayscale
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Apply Laplacian kernel [0, 1, 0; 1, -4, 1; 0, 1, 0]
  let variance = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        -4 * gray[idx] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx - width] +
        gray[idx + width];
      variance += laplacian * laplacian;
      count++;
    }
  }

  const sharpness = Math.sqrt(variance / count);
  const threshold = 5;
  const passed = sharpness > threshold;

  return {
    type: "sharpness",
    passed,
    value: sharpness,
    threshold,
    message: passed ? "Image is sharp" : "Image is blurry — hold steady",
  };
}

// Face detection check using MediaPipe
interface FaceDetectionResult {
  detected: boolean;
  centerX: number;
  centerY: number;
  widthRatio: number;
}

type FaceDetectorType = { detectForVideo: (video: HTMLVideoElement, timestamp: number) => { detections: Array<{ boundingBox: { originX: number; originY: number; width: number; height: number } }> } };
let faceDetectorPromise: Promise<FaceDetectorType | null> | null = null;

async function loadFaceDetector(): Promise<FaceDetectorType | null> {
  if (faceDetectorPromise) return faceDetectorPromise;

  faceDetectorPromise = (async () => {
    try {
      const vision = await import("@mediapipe/face_detection");
      const FaceDetection = vision.FaceDetection;
      const detector = new FaceDetection({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
      });

      detector.setOptions({
        model: "short",
        minDetectionConfidence: 0.5,
      });

      // Wait for model to load
      await new Promise<void>((resolve) => {
        detector.onResults(() => {
          resolve();
        });
      });

      return detector as unknown as FaceDetectorType;
    } catch (err) {
      console.error("Failed to load face detector:", err);
      faceDetectorPromise = null; // Allow retry on failure
      return null;
    }
  })();

  return faceDetectorPromise;
}

// Simplified face detection using canvas-based approach
function detectFaceFromCanvas(
  canvas: HTMLCanvasElement
): FaceDetectionResult {
  // Simple skin-color detection as fallback when MediaPipe isn't available
  const ctx = canvas.getContext("2d");
  if (!ctx) return { detected: false, centerX: 0.5, centerY: 0.5, widthRatio: 0 };

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let skinPixelCount = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = canvas.width;
  let maxX = 0;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Simple skin color detection in RGB
      if (
        r > 95 && g > 40 && b > 20 &&
        r > g && r > b &&
        Math.abs(r - g) > 15 &&
        r - b > 15
      ) {
        skinPixelCount++;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }

  const totalPixels = canvas.width * canvas.height;
  const skinRatio = skinPixelCount / totalPixels;

  if (skinRatio < 0.05) {
    return { detected: false, centerX: 0.5, centerY: 0.5, widthRatio: 0 };
  }

  const centerX = (sumX / skinPixelCount) / canvas.width;
  const centerY = (sumY / skinPixelCount) / canvas.height;
  const faceWidth = (maxX - minX) / canvas.width;

  return {
    detected: skinRatio > 0.08,
    centerX,
    centerY,
    widthRatio: faceWidth,
  };
}

function checkFaceDetected(faceResult: FaceDetectionResult): QualityCheckResult {
  return {
    type: "face_detected",
    passed: faceResult.detected,
    value: faceResult.detected ? 1 : 0,
    threshold: 1,
    message: faceResult.detected ? "Face detected" : "No face detected — make sure your face is visible",
  };
}

function checkFaceCentered(faceResult: FaceDetectionResult): QualityCheckResult {
  if (!faceResult.detected) {
    return {
      type: "face_centered",
      passed: false,
      value: 0,
      threshold: 0.3,
      message: "Center your face in the frame",
    };
  }

  const xOffset = Math.abs(faceResult.centerX - 0.5);
  const yOffset = Math.abs(faceResult.centerY - 0.4); // Slightly above center
  const offset = Math.sqrt(xOffset * xOffset + yOffset * yOffset);
  const passed = offset < 0.25;

  return {
    type: "face_centered",
    passed,
    value: offset,
    threshold: 0.25,
    message: passed ? "Face is centered" : "Move your face to the center of the frame",
  };
}

export interface QualityCheckOptions {
  checks: QualityCheckType[];
  canvas: HTMLCanvasElement;
  videoWidth?: number;
  videoHeight?: number;
}

export function runQualityChecks({
  checks,
  canvas,
}: QualityCheckOptions): QualityCheckResult[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const results: QualityCheckResult[] = [];

  // Get face detection result (shared across face checks)
  let faceResult: FaceDetectionResult | null = null;

  if (checks.includes("face_detected") || checks.includes("face_centered") || checks.includes("face_size")) {
    faceResult = detectFaceFromCanvas(canvas);
  }

  for (const check of checks) {
    switch (check) {
      case "brightness":
        results.push(checkBrightness(imageData));
        break;
      case "sharpness":
        results.push(checkSharpness(imageData, canvas.width, canvas.height));
        break;
      case "face_detected":
        results.push(checkFaceDetected(faceResult!));
        break;
      case "face_centered":
        results.push(checkFaceCentered(faceResult!));
        break;
      case "face_size":
        // Check face is big enough in frame
        if (faceResult) {
          const passed = faceResult.widthRatio > 0.15;
          results.push({
            type: "face_size",
            passed,
            value: faceResult.widthRatio,
            threshold: 0.15,
            message: passed ? "Good distance" : "Move closer to the camera",
          });
        }
        break;
    }
  }

  return results;
}

export { loadFaceDetector };
