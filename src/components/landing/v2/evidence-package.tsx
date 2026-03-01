import { EvidenceCard } from "./evidence-card";

const packageItems = [
  {
    title: "AI Generation Classification",
    desc: "Forensic analysis confirming content is AI-generated, with methodology documented in plain language — not a black-box confidence score, but an explanation of how we know and why it holds up.",
  },
  {
    title: "Facial Identity Match",
    desc: "Quantified similarity analysis proving the content depicts a specific individual, with reference image comparison and confidence scoring.",
  },
  {
    title: "Generation Method Analysis",
    desc: "Identifying how the content was created — face swap app, AI image generator, or custom-trained model — and documenting the specific technique used.",
  },
  {
    title: "Commercial Use Documentation",
    desc: "Ad spend data, platform metadata, and monetization evidence gathered from public ad transparency libraries and platform records.",
  },
  {
    title: "Timestamped Capture & Chain of Evidence",
    desc: "Content hashes, archived screenshots, source URLs, and full provenance documentation establishing when and where content existed.",
  },
];

export function EvidencePackage() {
  return (
    <section
      id="evidence"
      className="max-w-[1200px] mx-auto px-6 sm:px-12 py-16 md:py-24"
    >
      <div className="text-[12px] font-semibold text-[#DC2626] uppercase tracking-[1.5px] mb-4">
        What We Deliver
      </div>
      <h2 className="font-heading text-[clamp(32px,3.5vw,48px)] font-normal tracking-[-0.8px] leading-[1.15] mb-5 max-w-[640px] text-[#0C1424]">
        A complete forensic evidence package for every case.
      </h2>
      <p className="text-[17px] text-[#3A5070] max-w-[540px] leading-[1.65] mb-14">
        Takedown requests don&apos;t require forensic proof. Litigation does. We
        produce the documented, explainable evidence that attorneys need when
        cases move beyond platform removal.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left: package items */}
        <div className="flex flex-col gap-2.5">
          {packageItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5 p-4 bg-[#F8FAFD] border border-[#D0D8E6] rounded-[10px]"
            >
              <span className="text-[#DC2626] text-[14px] mt-0.5 shrink-0">
                ✦
              </span>
              <div>
                <div className="text-[14px] font-semibold text-[#0C1424] mb-1">
                  {item.title}
                </div>
                <div className="text-[13px] text-[#3A5070] leading-[1.5]">
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: evidence card + callout */}
        <div>
          <EvidenceCard
            headerLabel="Package Structure"
            statusText="Complete"
            statusColor="green"
            rows={[
              { label: "Section 1", value: "Subject Identity & Reference Images" },
              { label: "Section 2", value: "Infringing Content & Source URLs" },
              { label: "Section 3", value: "AI Classification & Methodology" },
              { label: "Section 4", value: "Facial Match Analysis" },
              { label: "Section 5", value: "Generation Method Identification" },
              { label: "Section 6", value: "Commercial Damages Evidence" },
              { label: "Section 7", value: "Chain of Evidence & Hashes" },
            ]}
            footerTags={[
              { text: "Documented Methodology", variant: "info" },
              { text: "Explainable Results", variant: "info" },
            ]}
          />

          <div className="mt-4 p-5 bg-[#DC2626]/5 rounded-[10px] border border-[#DC2626]/15">
            <p className="text-[13px] text-[#3A5070] leading-[1.6]">
              <span className="text-[#DC2626] font-semibold">
                Why this matters in court:
              </span>{" "}
              AI detection tools that return a confidence score without
              explaining their methodology are vulnerable to cross-examination.
              Our analysis documents exactly how we reached each conclusion — in
              language attorneys and juries can follow.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
