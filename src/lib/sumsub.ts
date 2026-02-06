import crypto from "crypto";

export function verifySumsubWebhook(
  body: string,
  signature: string
): boolean {
  const secret = process.env.SUMSUB_WEBHOOK_SECRET!;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const digest = hmac.digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  );
}

export type SumsubStatus = "pending" | "green" | "red" | "retry";

export interface SumsubWebhookPayload {
  applicantId: string;
  inspectionId: string;
  correlationId: string;
  externalUserId: string;
  type: string;
  reviewStatus: string;
  reviewResult?: {
    reviewAnswer: "GREEN" | "RED";
    rejectLabels?: string[];
  };
  createdAtMs: number;
}

export function mapSumsubStatus(
  payload: SumsubWebhookPayload
): SumsubStatus {
  if (payload.type === "applicantReviewed") {
    const answer = payload.reviewResult?.reviewAnswer;
    if (answer === "GREEN") return "green";
    if (answer === "RED") return "red";
  }
  if (payload.type === "applicantPending") return "pending";
  return "retry";
}
