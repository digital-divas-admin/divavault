import { Instagram, UserCheck, Upload, CheckCircle2 } from "lucide-react";

const steps = [
  {
    icon: Instagram,
    step: "01",
    title: "Sign Up",
    description:
      "Create an account with just your name and email. No credit card, no hidden commitments.",
  },
  {
    icon: UserCheck,
    step: "02",
    title: "Verify",
    description:
      "A quick ID check confirms you're a real person. This protects everyone from impersonation — including you.",
  },
  {
    icon: Upload,
    step: "03",
    title: "Contribute",
    description:
      "Upload or import photos from Instagram. You pick exactly which ones to share — nothing is selected for you.",
  },
  {
    icon: CheckCircle2,
    step: "04",
    title: "Review",
    description:
      "Review exactly what you're agreeing to, in plain language. Then you're done — and you can change your mind anytime.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 px-4 sm:py-24 sm:px-6 bg-card/30">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-bold text-center mb-4">
          How It <span className="text-neon">Works</span>
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-10 sm:mb-16">
          Four steps, fully transparent. Take your time — there&apos;s no rush.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {steps.map((s, i) => (
            <div key={s.step} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-neon/40 to-neon/10" />
              )}

              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-neon/10 border border-neon/20 flex items-center justify-center mx-auto mb-6">
                  <s.icon className="w-7 h-7 text-neon" />
                </div>
                <span className="text-xs font-mono text-neon/60 uppercase tracking-widest">
                  Step {s.step}
                </span>
                <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold mt-2 mb-3">
                  {s.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
