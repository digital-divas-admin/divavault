const capabilities = [
  {
    tag: "Proactive",
    title: "Continuous Scanning",
    desc: "We monitor the platforms where AI models and deepfake content are created and distributed — using facial recognition to find unauthorized content depicting your client across model hosting sites, creative communities, social media, and advertising channels. Most victims don't know the full scope of what exists. We find it before they do.",
  },
  {
    tag: "Preventive",
    title: "Image Protection",
    desc: "We process photos so they become resistant to AI tools — disrupting face swap apps, image generators, and model training while looking completely normal to the human eye. Ideal for headshots on agency websites, social media profiles, and portfolio pages that could be scraped and used to create deepfakes.",
  },
];

export function AdditionalCapabilities() {
  return (
    <section className="max-w-[1200px] mx-auto px-6 sm:px-12 pb-16 md:pb-24">
      <div className="text-[12px] font-semibold text-[#DC2626] uppercase tracking-[1.5px] mb-4">
        Additional Capabilities
      </div>
      <h2 className="font-heading text-[clamp(32px,3.5vw,48px)] font-normal tracking-[-0.8px] leading-[1.15] mb-5 max-w-[640px] text-[#0C1424]">
        Beyond case-specific evidence.
      </h2>
      <p className="text-[17px] text-[#3A5070] max-w-[540px] leading-[1.65] mb-14">
        Court-ready evidence is our core service. We also offer proactive
        capabilities for clients who want ongoing protection.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {capabilities.map((cap, i) => (
          <div
            key={i}
            className="bg-white border border-[#D0D8E6] rounded-xl p-8"
          >
            <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-[0.5px] bg-[#DC2626]/8 text-[#DC2626] mb-4">
              {cap.tag}
            </span>
            <h3 className="text-[18px] font-bold text-[#0C1424] tracking-[-0.2px] mb-2.5">
              {cap.title}
            </h3>
            <p className="text-[14.5px] text-[#3A5070] leading-[1.65]">
              {cap.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
