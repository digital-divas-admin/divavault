import { Lock, UserCheck, SlidersHorizontal, ShieldCheck } from "lucide-react";

const signals = [
  { icon: Lock, label: "Encrypted Storage" },
  { icon: UserCheck, label: "Identity Verified" },
  { icon: SlidersHorizontal, label: "You Stay in Control" },
  { icon: ShieldCheck, label: "Ethical AI Only" },
];

export function TrustBar() {
  return (
    <section className="py-6 sm:py-8 px-4 border-y border-border/50 bg-muted/30">
      <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-6 sm:gap-12">
        {signals.map((signal) => (
          <div
            key={signal.label}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <signal.icon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{signal.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
