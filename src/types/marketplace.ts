// Admin user roles
export type AdminRole = "reviewer" | "admin" | "super_admin";

export interface AdminUser {
  id: string;
  role: AdminRole;
  display_name: string;
  created_at: string;
  created_by: string | null;
}

// Contributor attributes
export interface ContributorAttributes {
  contributor_id: string;
  hair_color: string | null;
  eye_color: string | null;
  skin_tone: string | null;
  body_type: string | null;
  age_range: string | null;
  gender: string | null;
  ethnicity: string | null;
  self_description: string | null;
  share_hair_color: boolean;
  share_eye_color: boolean;
  share_skin_tone: boolean;
  share_body_type: boolean;
  share_age_range: boolean;
  share_gender: boolean;
  share_ethnicity: boolean;
  blocked_categories: string[];
  updated_at: string;
}
