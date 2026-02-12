import type { CaptureStep } from "@/types/capture";

export interface CoverageGroup {
  id: string;
  label: string;
  description: string;
  steps: CaptureStep[];
  pointsPerStep: number;
  maxPoints: number;
}

export const COVERAGE_GROUPS: CoverageGroup[] = [
  {
    id: "angles",
    label: "Angles",
    description: "Different head angles for comprehensive face matching",
    steps: ["face_front", "face_left", "face_right", "face_up", "face_down"],
    pointsPerStep: 6,
    maxPoints: 30,
  },
  {
    id: "expressions",
    label: "Expressions",
    description: "Various expressions to improve detection accuracy",
    steps: ["expression_smile", "expression_neutral", "expression_serious"],
    pointsPerStep: 5,
    maxPoints: 15,
  },
  {
    id: "body",
    label: "Body",
    description: "Upper and full body shots for complete coverage",
    steps: ["upper_body", "full_body"],
    pointsPerStep: 1,
    maxPoints: 2,
  },
];

export function getPointsForStep(step: CaptureStep): number {
  for (const group of COVERAGE_GROUPS) {
    if (group.steps.includes(step)) {
      return group.pointsPerStep;
    }
  }
  return 0;
}
