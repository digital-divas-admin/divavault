"use client";

import { Clock } from "lucide-react";

interface DeadlineCountdownProps {
  deadline: string | null;
  className?: string;
}

export function DeadlineCountdown({ deadline, className }: DeadlineCountdownProps) {
  if (!deadline) return null;

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return (
      <span className={`flex items-center gap-1 text-xs text-destructive ${className || ""}`}>
        <Clock className="h-3 w-3" />
        Expired
      </span>
    );
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  let text: string;
  let urgencyClass = "text-muted-foreground";

  if (days > 7) {
    text = `${days}d left`;
  } else if (days > 0) {
    text = `${days}d ${hours}h left`;
    urgencyClass = "text-yellow-400";
  } else {
    text = `${hours}h left`;
    urgencyClass = "text-destructive";
  }

  return (
    <span className={`flex items-center gap-1 text-xs ${urgencyClass} ${className || ""}`}>
      <Clock className="h-3 w-3" />
      {text}
    </span>
  );
}
