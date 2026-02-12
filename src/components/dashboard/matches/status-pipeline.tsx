const STAGES = ["new", "reviewed", "takedown_filed", "removed"] as const;

function getStageIndex(status: string): number {
  const idx = STAGES.indexOf(status as (typeof STAGES)[number]);
  return idx >= 0 ? idx : 0;
}

export function StatusPipeline({ status }: { status: string }) {
  const currentIdx = getStageIndex(status);
  // For dismissed, show all empty
  const isDismissed = status === "dismissed";

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, i) => {
        const isCompleted = !isDismissed && i <= currentIdx;
        return (
          <div
            key={stage}
            className={`w-2 h-2 rounded-full ${
              isCompleted
                ? i === currentIdx
                  ? "bg-primary"
                  : "bg-accent"
                : "bg-muted-foreground/20"
            }`}
          />
        );
      })}
    </div>
  );
}
