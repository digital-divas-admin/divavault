import { Upload, Radar, Gavel } from "lucide-react";

const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Upload & Verify",
    description:
      "Upload your photos and verify your identity to create a unique facial signature. This is the reference we use to scan for unauthorized use.",
  },
  {
    icon: Radar,
    number: "02",
    title: "Continuous Monitoring",
    description:
      "We scan CivitAI, DeviantArt, Reddit, and 244+ other platforms daily, looking for AI-generated content that matches your face.",
  },
  {
    icon: Gavel,
    number: "03",
    title: "Automated Protection",
    description:
      "When a match is found, DMCA takedown requests are filed automatically. Track every case in real-time from your dashboard.",
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
          Three steps to protect your likeness from unauthorized AI use.
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
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
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
