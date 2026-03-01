import Link from "next/link";

const highlights = [
  {
    emoji: "🏛️",
    title: "TAKE IT DOWN Act",
    desc: "Federal law signed May 2025 — platforms must remove deepfakes within 48 hours. When they don't, documented evidence supports FTC enforcement.",
  },
  {
    emoji: "📜",
    title: "Proposed Rule 707",
    desc: "Would subject AI-generated evidence to expert witness reliability standards — raising the bar for how deepfake evidence is evaluated in federal court.",
  },
  {
    emoji: "⚡",
    title: "State Criminal Penalties",
    desc: "PA, WA, TN and dozens of others now criminalize deepfake creation and distribution — creating both criminal and civil exposure.",
  },
  {
    emoji: "⚖️",
    title: "Courtroom Precedent",
    desc: "Judges are already sanctioning litigants for submitting deepfakes and requiring forensic authentication — the standard is being set now.",
  },
];

export function LegalLandscapeTeaser() {
  return (
    <section
      id="faq"
      className="max-w-[1200px] mx-auto px-6 sm:px-12 py-16 md:py-24"
    >
      <div className="bg-white border border-[#D0D8E6] rounded-2xl p-8 sm:p-14 grid grid-cols-1 lg:grid-cols-2 gap-14">
        {/* Left */}
        <div>
          <div className="text-[12px] font-semibold text-[#DC2626] uppercase tracking-[1.5px] mb-4">
            Legal Landscape
          </div>
          <h2 className="font-heading text-[36px] font-normal tracking-[-0.5px] leading-[1.15] mb-4 text-[#0C1424]">
            The law is moving fast.
            <br />
            Courts need evidence that keeps up.
          </h2>
          <p className="text-[15.5px] text-[#3A5070] leading-[1.65] mb-6">
            New federal legislation, proposed evidentiary rules, and expanding
            state criminal penalties are creating real legal frameworks for
            deepfake cases. The attorneys who can bring documented forensic
            evidence will have the strongest position.
          </p>
          <Link
            href="/legal-landscape"
            className="inline-flex items-center justify-center px-9 py-4 bg-transparent text-[#3A5070] border border-[#D0D8E6] rounded-[10px] font-medium text-[15px] hover:border-[#3A5070] hover:text-[#0C1424] transition-all"
          >
            Explore the Legal Landscape →
          </Link>
        </div>

        {/* Right: highlights */}
        <div className="flex flex-col gap-3">
          {highlights.map((h, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5 p-4 bg-[#F8FAFD] border border-[#D0D8E6] rounded-[10px]"
            >
              <div className="text-[20px] shrink-0 mt-0.5">{h.emoji}</div>
              <div className="flex flex-col gap-0.5">
                <strong className="text-[14px] font-semibold text-[#0C1424]">
                  {h.title}
                </strong>
                <span className="text-[12.5px] text-[#3A5070] leading-[1.5]">
                  {h.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
