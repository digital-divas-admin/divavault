"use client";

interface HealthData {
  status?: string;
  scanning?: boolean;
  pipeline?: boolean;
  coverage?: boolean;
  error?: string;
  ml?: {
    analyzers?: Array<{
      name: string;
      status: string;
      signal_count?: number;
      minimum_signals?: number;
    }>;
  };
}

interface HealthPulseBarProps {
  health: HealthData | null;
}

function StatusDot({
  label,
  active,
  loading,
}: {
  label: string;
  active: boolean;
  loading: boolean;
}) {
  const color = loading
    ? "bg-yellow-500"
    : active
      ? "bg-green-500"
      : "bg-red-500";
  const textColor = loading
    ? "text-yellow-400"
    : active
      ? "text-green-400"
      : "text-red-400";

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        {active && !loading && (
          <div
            className={`absolute inset-0 w-2 h-2 rounded-full ${color} animate-pulse`}
          />
        )}
      </div>
      <span className={`text-xs font-medium ${textColor}`}>{label}</span>
    </div>
  );
}

export function HealthPulseBar({ health }: HealthPulseBarProps) {
  const loading = health === null;
  const unreachable = health?.status === "unreachable";

  return (
    <div className="flex items-center gap-6 px-4 py-2 rounded-lg bg-card border border-border/30">
      <StatusDot
        label={unreachable ? "Unreachable" : "Scanning"}
        active={!unreachable && (health?.scanning ?? false)}
        loading={loading}
      />
      <StatusDot
        label="Pipeline"
        active={!unreachable && (health?.pipeline ?? false)}
        loading={loading}
      />
      <StatusDot
        label="Coverage"
        active={!unreachable && (health?.coverage ?? false)}
        loading={loading}
      />
      {health?.error && (
        <span className="text-xs text-red-400 ml-auto">{health.error}</span>
      )}
    </div>
  );
}
