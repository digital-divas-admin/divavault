const typicalItems = [
  "Returns a confidence score with no explanation",
  "Proprietary model — methodology can't be disclosed",
  "Unknown false positive rate",
  "No analysis of how the content was generated",
  "Vulnerable to cross-examination on reliability",
];

const ourItems = [
  "Documents specific artifacts and indicators found",
  "Methodology explained in plain language",
  "Multiple detection approaches corroborate each finding",
  "Identifies the specific generation method used",
  "Analysis built to withstand adversarial scrutiny",
];

const processSteps = [
  {
    number: "01",
    title: "Intake & Scope",
    desc: "You share what you have — the content in question, reference photos of your client, and the legal context. We assess the case and determine what evidence is needed.",
  },
  {
    number: "02",
    title: "Forensic Analysis",
    desc: "We classify the content as AI-generated using documented methodology, match it to your client's identity, and identify the specific generation method. If additional instances exist on other platforms, we find those too.",
  },
  {
    number: "03",
    title: "Damages Documentation",
    desc: "We document commercial use — ad spend, platform distribution, monetization channels — establishing the provable financial damages that give cases real leverage.",
  },
  {
    number: "04",
    title: "Package Delivery",
    desc: "Complete evidence package with every finding documented, methodology explained, and chain of evidence preserved. Ready for litigation, settlement negotiations, or enforcement action.",
  },
];

export function Methodology() {
  return (
    <section
      id="methodology"
      className="max-w-[1200px] mx-auto px-6 sm:px-12 py-16 md:py-24"
    >
      {/* Anchor for existing nav compat */}
      <div id="how-it-works" className="scroll-mt-20" />

      <div className="text-[12px] font-semibold text-[#DC2626] uppercase tracking-[1.5px] mb-4">
        Our Methodology
      </div>
      <h2 className="font-heading text-[clamp(32px,3.5vw,48px)] font-normal tracking-[-0.8px] leading-[1.15] mb-5 max-w-[640px] text-[#0C1424]">
        Explainable forensics, not black-box scores.
      </h2>
      <p className="text-[17px] text-[#3A5070] max-w-[540px] leading-[1.65] mb-10">
        Most AI detection tools return a percentage and can&apos;t explain how
        they got it. When opposing counsel asks &quot;how does your tool
        work?&quot; — if the answer is &quot;it&apos;s proprietary&quot; —
        that&apos;s a problem.
      </p>

      {/* Comparison grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Typical tool */}
        <div className="bg-white border border-[#D0D8E6] rounded-xl p-7">
          <h4 className="text-[16px] font-bold text-[#3A5070] mb-4">
            Typical AI Detection Tool
          </h4>
          <ul className="space-y-0">
            {typicalItems.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[13.5px] text-[#3A5070] leading-[1.6] py-2 border-b border-[#D0D8E6]/50 last:border-b-0"
              >
                <span className="text-[#DC2626] shrink-0">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Our approach */}
        <div className="bg-white border-2 border-[#DC2626]/30 rounded-xl p-7">
          <h4 className="text-[16px] font-bold text-[#DC2626] mb-4">
            Our Forensic Analysis
          </h4>
          <ul className="space-y-0">
            {ourItems.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[13.5px] text-[#3A5070] leading-[1.6] py-2 border-b border-[#D0D8E6]/50 last:border-b-0"
              >
                <span className="text-[#22C55E] shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Process steps */}
      <div className="mt-20">
        <div className="text-[12px] font-semibold text-[#DC2626] uppercase tracking-[1.5px] mb-4">
          How We Work
        </div>
        <h3 className="font-heading text-[32px] font-normal tracking-[-0.5px] leading-[1.2] mb-10 text-[#0C1424]">
          From content to court-ready package.
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {processSteps.map((step) => (
            <div
              key={step.number}
              className="bg-white border border-[#D0D8E6] rounded-xl p-8 hover:border-[#D0D8E6]/80 hover:shadow-sm transition-all"
            >
              <div className="font-heading text-[32px] text-[#DC2626]/15 leading-none mb-4">
                {step.number}
              </div>
              <h3 className="text-[19px] font-bold text-[#0C1424] tracking-[-0.2px] mb-2.5">
                {step.title}
              </h3>
              <p className="text-[14.5px] text-[#3A5070] leading-[1.65]">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
