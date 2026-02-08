import type { CaptureStepConfig, CaptureStep } from "@/types/capture";

export const CAPTURE_STEPS: CaptureStepConfig[] = [
  {
    id: "face_front",
    label: "Front Face",
    instruction: "Look straight at the camera with a neutral expression.",
    poseGuide: "face_oval",
    requiredChecks: ["face_detected", "sharpness", "brightness", "face_centered"],
  },
  {
    id: "face_left",
    label: "Left Profile",
    instruction: "Turn your head to show your left side (your left ear toward the camera).",
    poseGuide: "face_oval",
    requiredChecks: ["face_detected", "sharpness", "brightness"],
  },
  {
    id: "face_right",
    label: "Right Profile",
    instruction: "Turn your head to show your right side (your right ear toward the camera).",
    poseGuide: "face_oval",
    requiredChecks: ["face_detected", "sharpness", "brightness"],
  },
  {
    id: "face_up",
    label: "Face Tilted Up",
    instruction: "Tilt your chin upward slightly while looking at the camera.",
    poseGuide: "face_oval",
    requiredChecks: ["face_detected", "sharpness", "brightness"],
  },
  {
    id: "face_down",
    label: "Face Tilted Down",
    instruction: "Tilt your chin downward slightly while looking at the camera.",
    poseGuide: "face_oval",
    requiredChecks: ["face_detected", "sharpness", "brightness"],
  },
  {
    id: "expression_smile",
    label: "Smiling",
    instruction: "Give us a natural smile!",
    poseGuide: "face_oval",
    requiredChecks: ["face_detected", "sharpness", "brightness", "face_centered"],
  },
  {
    id: "expression_neutral",
    label: "Neutral Expression",
    instruction: "Relax your face — neutral, calm expression.",
    poseGuide: "face_oval",
    requiredChecks: ["face_detected", "sharpness", "brightness", "face_centered"],
  },
  {
    id: "expression_serious",
    label: "Serious Expression",
    instruction: "A confident, serious look straight at the camera.",
    poseGuide: "face_oval",
    requiredChecks: ["face_detected", "sharpness", "brightness", "face_centered"],
  },
  {
    id: "upper_body",
    label: "Upper Body",
    instruction: "Step back so we can see from your waist up. Arms at your sides.",
    poseGuide: "upper_body",
    requiredChecks: ["face_detected", "sharpness", "brightness"],
  },
  {
    id: "full_body",
    label: "Full Body",
    instruction: "Step further back for a full-body shot. Stand naturally.",
    poseGuide: "full_body",
    requiredChecks: ["sharpness", "brightness"],
  },
];

export const MIN_CAPTURE_STEPS = 9;

export function getStepConfig(stepId: CaptureStep): CaptureStepConfig | undefined {
  return CAPTURE_STEPS.find((s) => s.id === stepId);
}
