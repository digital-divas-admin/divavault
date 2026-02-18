"use client";

export function ScanLineHeader() {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Scanner Command Center
        </h1>
        <span className="text-xs text-muted-foreground font-[family-name:var(--font-mono)]">
          v2.0
        </span>
      </div>
      <p className="text-muted-foreground text-sm">
        Unified scanner monitoring, ML intelligence, and crawl management
      </p>
      {/* Animated scan line */}
      <div className="mt-3 h-px w-full overflow-hidden rounded-full">
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, #8B5CF6, transparent)",
            animation: "scanLine 3s ease-in-out infinite",
          }}
        />
      </div>
      <style jsx>{`
        @keyframes scanLine {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
