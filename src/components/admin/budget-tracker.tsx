interface BudgetTrackerProps {
  spentCents: number;
  totalCents: number;
}

export function BudgetTracker({ spentCents, totalCents }: BudgetTrackerProps) {
  const percentage = totalCents > 0 ? Math.min((spentCents / totalCents) * 100, 100) : 0;
  const color =
    percentage > 90
      ? "bg-destructive"
      : percentage > 75
        ? "bg-yellow-500"
        : "bg-green-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Budget</span>
        <span className="font-medium">
          ${(spentCents / 100).toFixed(2)} / ${(totalCents / 100).toFixed(2)}
          <span className="text-muted-foreground ml-1">
            ({percentage.toFixed(0)}%)
          </span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
