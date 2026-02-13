import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Bot, ScanSearch, Banknote, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: User,
    label: "Real Person",
    detail: "Your face, your identity",
    color: "#8B5CF6",
    glow: "rgba(139,92,246,0.25)",
  },
  {
    icon: Bot,
    label: "AI Generates",
    detail: "Models use your likeness",
    color: "#EF4444",
    glow: "rgba(239,68,68,0.25)",
  },
  {
    icon: ScanSearch,
    label: "We Detect It",
    detail: "247+ platforms scanned daily",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.25)",
  },
  {
    icon: Banknote,
    label: "You Get Paid",
    detail: "Royalties or removal — your call",
    color: "#22C55E",
    glow: "rgba(34,197,94,0.25)",
  },
];

export function CompensationFlow() {
  return (
    <section className="section-elevated py-16 px-4 sm:py-24 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="purple" className="mb-5 px-3 py-1 text-sm">
            The missing piece
          </Badge>
          <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl tracking-tight mb-5 leading-tight">
            Real people should get paid when{" "}
            <span className="text-primary">their faces come out of AI.</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Your likeness has value. When AI models generate content using your
            face, you deserve to know — and you deserve to be compensated.
          </p>
        </div>

        {/* Flow pipeline — Desktop (horizontal) */}
        <div className="hidden md:block mb-12">
          <div className="grid grid-cols-4 gap-0 relative">
            {/* Connecting lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              {[0, 1, 2].map((i) => {
                const x1 = `${(i * 25) + 18}%`;
                const x2 = `${((i + 1) * 25) + 7}%`;
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1="44px"
                    x2={x2}
                    y2="44px"
                    stroke="rgba(139,92,246,0.3)"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    className="flow-line-dash"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                );
              })}
            </svg>

            {steps.map((step) => (
              <div key={step.label} className="flex flex-col items-center text-center relative z-10">
                {/* Node */}
                <div
                  className="w-[88px] h-[88px] rounded-2xl flex items-center justify-center mb-4 border border-border/50"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${step.color} 10%, #18181B)`,
                    boxShadow: `0 0 24px ${step.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  }}
                >
                  <step.icon
                    className="w-8 h-8"
                    style={{ color: step.color }}
                  />
                </div>

                {/* Label */}
                <h3 className="font-[family-name:var(--font-heading)] text-lg mb-1">
                  {step.label}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[160px]">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Flow pipeline — Mobile (vertical) */}
        <div className="md:hidden mb-10">
          <div className="flex flex-col items-center gap-0">
            {steps.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center">
                {/* Connector line above (skip first) */}
                {i > 0 && (
                  <div
                    className="w-[2px] h-8 flow-line-dash-vertical"
                    style={{ animationDelay: `${(i - 1) * 0.3}s` }}
                    aria-hidden="true"
                  />
                )}

                {/* Step card */}
                <div className="flex items-center gap-4 bg-card border border-border/50 rounded-xl p-4 w-full max-w-xs">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${step.color} 12%, #18181B)`,
                      boxShadow: `0 0 16px ${step.glow}`,
                    }}
                  >
                    <step.icon
                      className="w-5 h-5"
                      style={{ color: step.color }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--font-heading)] text-base">
                      {step.label}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <Button
            asChild
            size="lg"
            className="text-base px-8 py-6 rounded-full"
          >
            <Link href="/signup">
              Start Getting Compensated
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Free tier available. No credit card required.
          </p>
        </div>
      </div>
    </section>
  );
}
