const steps = [
  {
    number: "1",
    title: "Register",
    description:
      "Upload your photos and verify your identity. We create a unique facial signature that serves as the reference for scanning.",
  },
  {
    number: "2",
    title: "We Scan",
    description:
      "Continuous monitoring across 247+ platforms — CivitAI, DeviantArt, Reddit, and more. Every day, around the clock.",
  },
  {
    number: "3",
    title: "We Act",
    description:
      "When a match is found, we document everything, file DMCA takedowns automatically, and build your case for further action.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 px-4 sm:py-24 sm:px-6 bg-[#F0F4FA]">
      <div className="max-w-3xl mx-auto">
        <p className="font-[family-name:var(--font-mono)] text-xs sm:text-sm font-medium uppercase tracking-widest text-[#DC2626] mb-4">
          How It Works
        </p>
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-[#0C1424] mb-12 sm:mb-16">
          Three steps to protection.
        </h2>

        <div className="relative">
          {steps.map((step, i) => (
            <div key={step.number} className="relative flex gap-6 pb-12 last:pb-0">
              {/* Timeline line + circle */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#DC2626] text-white flex items-center justify-center text-lg font-bold shrink-0">
                  {step.number}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gradient-to-b from-[#DC2626] to-[#D0D8E6] mt-3" />
                )}
              </div>

              {/* Content */}
              <div className="pt-2.5">
                <h3 className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl text-[#0C1424] mb-2">
                  {step.title}
                </h3>
                <p className="font-[family-name:var(--font-outfit)] text-[#3A5070] text-sm sm:text-base leading-relaxed max-w-md">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
