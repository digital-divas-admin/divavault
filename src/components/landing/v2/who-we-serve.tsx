const audiences = [
  {
    emoji: "⚖️",
    title: "Attorneys",
    desc: "Handling right of publicity, defamation, NCII, or Lanham Act cases involving AI-generated likenesses. We build the evidence package that supports your legal strategy.",
    bullets: [
      "Forensic evidence packages for litigation",
      "Explainable methodology for court",
      "Generation method identification",
      "Commercial damages documentation",
    ],
  },
  {
    emoji: "🎭",
    title: "Talent & Management",
    desc: "Agencies and managers who need more than a takedown — when unauthorized use of a client's face requires legal action, we provide the forensic foundation.",
    bullets: [
      "Evidence for cease & desist actions",
      "Documentation for settlement demands",
      "Multi-platform violation mapping",
      "Monetization and damages analysis",
    ],
  },
  {
    emoji: "🔍",
    title: "Content Removal Firms",
    desc: "When a standard takedown case escalates — the client wants to sue, content keeps reappearing, or the deepfake needs forensic verification — we handle the technical analysis.",
    bullets: [
      "Forensic verification for complex cases",
      "Technical analysis beyond standard tools",
      "Evidence packaging for legal escalation",
      "Generation method expertise",
    ],
  },
];

export function WhoWeServe() {
  return (
    <section
      id="clients"
      className="max-w-[1200px] mx-auto px-6 sm:px-12 py-16 md:py-24"
    >
      <div className="text-[12px] font-semibold text-[#DC2626] uppercase tracking-[1.5px] mb-4">
        Who We Serve
      </div>
      <h2 className="font-heading text-[clamp(32px,3.5vw,48px)] font-normal tracking-[-0.8px] leading-[1.15] mb-5 max-w-[640px] text-[#0C1424]">
        Built for the people building deepfake cases.
      </h2>
      <p className="text-[17px] text-[#3A5070] max-w-[540px] leading-[1.65] mb-14">
        We work with a small number of clients who need documented forensic
        evidence — not a self-serve detection tool.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {audiences.map((a, i) => (
          <div
            key={i}
            className="card-hover bg-white border border-[#D0D8E6] rounded-xl p-8 relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-xl bg-[#DC2626]/8 flex items-center justify-center text-[22px] mb-6">
              {a.emoji}
            </div>
            <h3 className="text-[20px] font-bold text-[#0C1424] tracking-[-0.3px] mb-3">
              {a.title}
            </h3>
            <p className="text-[14.5px] text-[#3A5070] leading-[1.65] mb-6">
              {a.desc}
            </p>
            <ul className="flex flex-col gap-2.5">
              {a.bullets.map((b, j) => (
                <li
                  key={j}
                  className="text-[13.5px] text-[#3A5070] leading-[1.5] pl-4 relative"
                >
                  <span className="absolute left-0 top-[8px] w-[5px] h-[5px] bg-[#DC2626] rounded-full" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
