const knowledgeAreas = [
  {
    label: "Generation Tools",
    desc: "We understand the full range — from one-click face swap apps to custom-trained AI models to commercial image generators. Knowing which tool was used changes the forensic approach.",
  },
  {
    label: "Distribution Networks",
    desc: "When thousands of face models were migrated and renamed to dodge a platform ban, we tracked where they went. We monitor communities others don't know to look in.",
  },
  {
    label: "Monetization Channels",
    desc: "Deepfakes become litigation-worthy when someone profits. We know how AI content gets turned into revenue — from ad campaigns using stolen faces to paid generation services.",
  },
];

export function DomainKnowledge() {
  return (
    <section className="max-w-[1200px] mx-auto px-6 sm:px-12 pb-16 md:pb-24">
      <div className="bg-[#DC2626]/5 border border-[#DC2626]/15 rounded-xl p-8 sm:p-11">
        <div className="text-[12px] font-semibold text-[#DC2626] uppercase tracking-[1.5px] mb-4">
          Why Us
        </div>
        <h3 className="font-heading text-[32px] font-normal tracking-[-0.5px] leading-[1.2] mb-5 text-[#0C1424]">
          We know how deepfakes are made because
          <br className="hidden sm:block" /> we&apos;ve tracked their evolution
          for three years.
        </h3>
        <p className="text-[15.5px] text-[#3A5070] leading-[1.65] mb-8 max-w-[680px]">
          Identifying a deepfake isn&apos;t just about running a detection scan.
          It requires understanding the tools, the communities, and the
          distribution channels. We&apos;ve been embedded in this space since AI
          generation tools first appeared — monitoring the platforms where models
          are built and shared, tracking how content migrates when platforms
          crack down, and understanding how unauthorized deepfake content gets
          monetized.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {knowledgeAreas.map((area, i) => (
            <div
              key={i}
              className="bg-white border border-[#D0D8E6] rounded-xl p-5"
            >
              <div className="text-[12px] text-[#DC2626] font-semibold uppercase tracking-[1px] mb-2.5">
                {area.label}
              </div>
              <p className="text-[13.5px] text-[#3A5070] leading-[1.6]">
                {area.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
