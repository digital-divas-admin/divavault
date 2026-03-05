import { ImageResponse } from "next/og";
import { getInvestigationBySlug } from "@/lib/investigation-queries";
import { VERDICT_LABELS, CATEGORY_LABELS } from "@/types/investigations";

export const runtime = "edge";
export const alt = "Investigation by Consented AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VERDICT_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed_fake: { bg: "#FEE2E2", text: "#DC2626" },
  likely_fake: { bg: "#FFEDD5", text: "#EA580C" },
  inconclusive: { bg: "#FEF9C3", text: "#CA8A04" },
  likely_real: { bg: "#DBEAFE", text: "#2563EB" },
  confirmed_real: { bg: "#DCFCE7", text: "#16A34A" },
};

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const investigation = await getInvestigationBySlug(slug);

  if (!investigation) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F0F4FA",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <span style={{ fontSize: 48, color: "#64748B" }}>Investigation Not Found</span>
        </div>
      ),
      { ...size }
    );
  }

  const verdictText = investigation.verdict
    ? VERDICT_LABELS[investigation.verdict]
    : null;
  const verdictColors = investigation.verdict
    ? VERDICT_BADGE_COLORS[investigation.verdict]
    : null;
  const categoryText = CATEGORY_LABELS[investigation.category];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F0F4FA",
          fontFamily: "system-ui, sans-serif",
          padding: "60px 70px",
          position: "relative",
        }}
      >
        {/* Top red accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            backgroundColor: "#DC2626",
          }}
        />

        {/* Category + Confidence */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: "#DC2626",
              padding: "6px 16px",
              borderRadius: 20,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {categoryText}
          </span>
          {investigation.confidence_score !== null && (
            <span style={{ fontSize: 16, fontWeight: 600, color: "#64748B" }}>
              {investigation.confidence_score}% Confidence
            </span>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#0F172A",
            lineHeight: 1.15,
            marginBottom: 24,
            maxHeight: 200,
            overflow: "hidden",
            display: "flex",
          }}
        >
          {investigation.title}
        </div>

        {/* Description (truncated) */}
        {investigation.description && (
          <div
            style={{
              fontSize: 22,
              color: "#64748B",
              lineHeight: 1.4,
              marginBottom: 24,
              maxHeight: 70,
              overflow: "hidden",
              display: "flex",
            }}
          >
            {investigation.description.length > 120
              ? investigation.description.slice(0, 120) + "..."
              : investigation.description}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1, display: "flex" }} />

        {/* Bottom bar: verdict + branding */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {verdictText && verdictColors && (
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: verdictColors.text,
                  backgroundColor: verdictColors.bg,
                  padding: "8px 24px",
                  borderRadius: 24,
                  border: `2px solid ${verdictColors.text}20`,
                }}
              >
                {verdictText}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#0F172A" }}>
              consented
            </span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#DC2626" }}>
              ai
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
