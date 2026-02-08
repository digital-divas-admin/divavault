import { UserPlus, UserCheck, Upload } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    number: "01",
    title: "Sign Up & Verify",
    description:
      "Create an account and complete a quick identity check. This confirms you're a real person and protects everyone from impersonation.",
  },
  {
    icon: Upload,
    number: "02",
    title: "Upload Your Content",
    description:
      "Import from Instagram or drag-and-drop your photos. You pick exactly which ones to share — nothing is selected for you.",
  },
  {
    icon: UserCheck,
    number: "03",
    title: "Earn From AI Training",
    description:
      "Review your consent in plain language, then you're done. When our payment system launches, early contributors are first in line.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 px-4 sm:py-24 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-center mb-4">
          How It Works
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          Three steps, fully transparent. Take your time — there&apos;s no rush.
        </p>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-card border border-border rounded-2xl p-6 sm:p-8 card-hover border-t-2 border-t-transparent"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  {step.number}
                </div>
                <step.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-[family-name:var(--font-heading)] text-xl mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
