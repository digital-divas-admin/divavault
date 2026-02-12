import type { MatchTakedown } from "@/types/protection";
import { formatDate } from "@/lib/format";

interface TakedownTimelineProps {
  takedowns: MatchTakedown[];
}

interface TimelineStage {
  label: string;
  status: "completed" | "active" | "pending";
  date: string | null;
}

function getStages(takedown: MatchTakedown): TimelineStage[] {
  const stages: TimelineStage[] = [
    { label: "Created", status: "completed", date: takedown.created_at },
    { label: "Submitted", status: "pending", date: null },
    { label: "Platform Review", status: "pending", date: null },
    { label: "Resolution", status: "pending", date: null },
  ];

  if (takedown.submitted_at) {
    stages[1] = { label: "Submitted", status: "completed", date: takedown.submitted_at };
  }

  if (takedown.status === "submitted") {
    stages[1] = { ...stages[1], status: "completed", date: takedown.submitted_at || takedown.created_at };
    stages[2] = { ...stages[2], status: "active" };
  }

  if (takedown.status === "completed" || takedown.status === "removed") {
    stages[1] = { ...stages[1], status: "completed", date: takedown.submitted_at || takedown.created_at };
    stages[2] = { ...stages[2], status: "completed" };
    stages[3] = { label: "Resolution", status: "completed", date: takedown.resolved_at };
  }

  if (takedown.status === "pending" && !takedown.submitted_at) {
    stages[1] = { ...stages[1], status: "active" };
  }

  return stages;
}

export function TakedownTimeline({ takedowns }: TakedownTimelineProps) {
  if (takedowns.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">
          No takedowns filed yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {takedowns.map((takedown) => {
        const stages = getStages(takedown);
        return (
          <div key={takedown.id}>
            <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wide">
              {takedown.takedown_type.toUpperCase()} — {takedown.platform}
            </p>
            <div className="relative pl-6">
              {stages.map((stage, i) => {
                const isLast = i === stages.length - 1;
                return (
                  <div key={stage.label} className="relative pb-6 last:pb-0">
                    {/* Connecting line */}
                    {!isLast && (
                      <div
                        className={`absolute left-[-18px] top-3 bottom-0 w-0.5 ${
                          stage.status === "completed"
                            ? "bg-accent"
                            : "border-l border-dashed border-muted-foreground/30"
                        }`}
                      />
                    )}
                    {/* Node */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`absolute left-[-22px] w-[9px] h-[9px] rounded-full border-2 ${
                          stage.status === "completed"
                            ? "bg-accent border-accent"
                            : stage.status === "active"
                              ? "bg-yellow-500 border-yellow-500 timeline-node-active"
                              : "bg-transparent border-muted-foreground/30"
                        }`}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <span
                          className={`text-sm ${
                            stage.status === "pending"
                              ? "text-muted-foreground/50"
                              : "text-foreground"
                          }`}
                        >
                          {stage.label}
                          {stage.status === "active" && (
                            <span className="text-yellow-500 ml-2 text-xs">Pending...</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {stage.date ? formatDate(stage.date) : "---"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
