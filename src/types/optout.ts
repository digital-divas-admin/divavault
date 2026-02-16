export type OptOutMethod = "email" | "web_form" | "account_settings" | "none";

export type OptOutRequestStatus =
  | "not_started"
  | "sent"
  | "follow_up_sent"
  | "confirmed"
  | "denied"
  | "unresponsive"
  | "completed_web"
  | "completed_settings";

export type CommunicationDirection = "outbound" | "inbound";

export type CommunicationType =
  | "initial_notice"
  | "follow_up"
  | "response"
  | "confirmation"
  | "denial";

export type CompanyCategory =
  | "model_training"
  | "image_generation"
  | "content_platform"
  | "social_media";

export interface AICompany {
  slug: string;
  name: string;
  description: string;
  method: OptOutMethod;
  contactEmail: string | null;
  optOutUrl: string | null;
  instructionsMarkdown: string;
  dataPractices: string;
  category: CompanyCategory;
}

export interface OptOutRequest {
  id: string;
  contributor_id: string;
  company_slug: string;
  status: OptOutRequestStatus;
  method: OptOutMethod;
  follow_up_days: number;
  last_sent_at: string | null;
  follow_up_count: number;
  max_follow_ups: number;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OptOutCommunication {
  id: string;
  request_id: string;
  contributor_id: string;
  direction: CommunicationDirection;
  communication_type: CommunicationType;
  subject: string | null;
  content_text: string;
  content_hash: string;
  template_version: string | null;
  recipient_email: string | null;
  resend_message_id: string | null;
  sent_at: string | null;
  evidence_file_path: string | null;
  evidence_file_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Merged view of a company + the user's opt-out request (if any). */
export interface OptOutCompanyView {
  company: AICompany;
  request: OptOutRequest | null;
  communicationCount: number;
  lastActivity: string | null;
}

export interface OptOutStats {
  totalCompanies: number;
  contacted: number;
  confirmed: number;
  pending: number;
  successRate: number;
}

export interface OptOutRequestDetail {
  request: OptOutRequest;
  company: AICompany;
  communications: OptOutCommunication[];
}
