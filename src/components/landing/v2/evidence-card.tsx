interface EvidenceRow {
  label: string;
  value: string;
  variant?: "match" | "verified" | "mono";
}

interface EvidenceTag {
  text: string;
  variant: "alert" | "info";
}

interface EvidenceCardProps {
  headerLabel: string;
  statusText: string;
  statusColor: "red" | "green";
  rows: EvidenceRow[];
  footerTags: EvidenceTag[];
}

export function EvidenceCard({
  headerLabel,
  statusText,
  statusColor,
  rows,
  footerTags,
}: EvidenceCardProps) {
  const statusColorClass =
    statusColor === "red" ? "text-[#DC2626]" : "text-[#22C55E]";
  const dotColorClass =
    statusColor === "red" ? "bg-[#DC2626]" : "bg-[#22C55E]";

  return (
    <div className="bg-white border border-[#D0D8E6] rounded-xl p-7 text-[13px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#D0D8E6]">
        <span className="font-semibold text-[12px] uppercase tracking-wider text-[#3A5070]">
          {headerLabel}
        </span>
        <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${statusColorClass}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
          {statusText}
        </div>
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex justify-between py-2.5 border-b border-[#D0D8E6]/50 last:border-b-0"
        >
          <span className="text-[#3A5070] text-[13px]">{row.label}</span>
          <span
            className={`font-medium text-[13px] text-right ${
              row.variant === "match"
                ? "text-[#DC2626]"
                : row.variant === "verified"
                  ? "text-[#22C55E]"
                  : row.variant === "mono"
                    ? "font-mono text-[11px] text-[#0C1424]"
                    : "text-[#0C1424]"
            }`}
          >
            {row.value}
          </span>
        </div>
      ))}

      {/* Footer tags */}
      {footerTags.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#D0D8E6] flex gap-2">
          {footerTags.map((tag, i) => (
            <span
              key={i}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide ${
                tag.variant === "alert"
                  ? "bg-[#DC2626]/8 text-[#DC2626]"
                  : "bg-[#DC2626]/5 text-[#DC2626]"
              }`}
            >
              {tag.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
