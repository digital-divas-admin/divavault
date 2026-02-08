interface ProgressIndicatorProps {
  fulfilled: number;
  needed: number;
  size?: "sm" | "md";
}

export function ProgressIndicator({
  fulfilled,
  needed,
  size = "sm",
}: ProgressIndicatorProps) {
  const percentage = needed > 0 ? Math.min((fulfilled / needed) * 100, 100) : 0;
  const radius = size === "sm" ? 16 : 20;
  const stroke = size === "sm" ? 3 : 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const svgSize = (radius + stroke) * 2;

  return (
    <div className="flex items-center gap-2">
      <svg
        width={svgSize}
        height={svgSize}
        className="-rotate-90"
      >
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
        />
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-300"
        />
      </svg>
      <span className={`text-muted-foreground ${size === "sm" ? "text-xs" : "text-sm"}`}>
        {fulfilled}/{needed}
      </span>
    </div>
  );
}
