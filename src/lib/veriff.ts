import crypto from "crypto";

export function verifyVeriffWebhook(body: string, signature: string): boolean {
  const secret = process.env.VERIFF_SHARED_SECRET!;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const digest = hmac.digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  );
}

export type VerificationStatus = "pending" | "green" | "red" | "retry";

export interface VeriffDecisionPayload {
  status: string;
  verification: {
    id: string;
    status:
      | "approved"
      | "declined"
      | "resubmission_requested"
      | "review"
      | "expired"
      | "abandoned";
    code: number;
    reason: string | null;
    vendorData: string | null; // our user.id
    person: { firstName: string; lastName: string };
  };
}

export function mapVeriffStatus(
  payload: VeriffDecisionPayload
): VerificationStatus {
  const s = payload.verification.status;
  if (s === "approved") return "green";
  if (s === "declined" || s === "expired" || s === "abandoned") return "red";
  if (s === "resubmission_requested") return "retry";
  // "review" or unknown
  return "pending";
}
