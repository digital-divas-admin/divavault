export type ProtectionLevel = "strong" | "moderate" | "basic" | "none";

export type BillStatus =
  | "signed"
  | "passed"
  | "committee"
  | "introduced"
  | "expired";

export type DevelopmentCategory =
  | "legislation"
  | "court-ruling"
  | "enforcement"
  | "industry";

export interface StateLaw {
  name: string;
  year: number;
  description: string;
  scope: string;
}

export interface CoverageGap {
  area: string;
  description: string;
}

export interface ActionPath {
  title: string;
  steps: string[];
  ctaLabel: string;
  ctaHref: string;
  external?: boolean;
}

export interface StateData {
  name: string;
  abbreviation: string;
  fips: string;
  protectionLevel: ProtectionLevel;
  riskScore: number;
  summary: string;
  laws: StateLaw[];
  gaps: CoverageGap[];
  actionPaths: ActionPath[];
  highlights: string[];
}

export interface FederalBill {
  id: string;
  name: string;
  billNumber: string;
  status: BillStatus;
  sponsors: string[];
  summary: string;
  lastAction: string;
  lastActionDate: string;
  relevance: string;
}

export interface DevelopmentEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  category: DevelopmentCategory;
  source?: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}
