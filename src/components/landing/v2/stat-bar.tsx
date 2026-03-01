const stats = [
  {
    number: "80%+",
    label:
      "Of court cases now involve video or image evidence — deepfake challenges are rising fast",
  },
  {
    number: "47",
    label:
      "States with enacted deepfake legislation — 82% passed in the last two years",
  },
  {
    number: "707",
    label:
      "Proposed Federal Rule of Evidence requiring reliability standards for AI-generated material",
  },
  {
    number: "$603K",
    label:
      "Average financial loss per company from deepfake-enabled attacks in 2025",
  },
];

export function StatBar() {
  return (
    <section className="bg-[#0C1424] text-white">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-12 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={i}
              className={`text-center px-6 py-4 sm:py-0 ${
                i < stats.length - 1
                  ? "lg:border-r lg:border-white/15"
                  : ""
              }`}
            >
              <div className="font-heading text-[44px] tracking-[-1px] leading-none mb-2">
                {stat.number}
              </div>
              <div className="text-[13px] text-white/50 leading-[1.4]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
