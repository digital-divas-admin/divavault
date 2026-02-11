export interface ProtectionScoreBreakdown {
  angleCoverage: {
    score: number;
    max: number;
    covered: string[];
    missing: string[];
  };
  expressionCoverage: {
    score: number;
    max: number;
    covered: string[];
    missing: string[];
  };
  photoCount: { score: number; max: number; count: number };
  averageQuality: { score: number; max: number; avgQuality: number };
  centroidComputed: { score: number; max: number; exists: boolean };
  embeddingSuccessRate: { score: number; max: number; rate: number };
}

export interface ProtectionScore {
  score: number;
  breakdown: ProtectionScoreBreakdown;
  suggestions: string[];
  tier: "minimal" | "basic" | "good" | "strong" | "excellent";
}
