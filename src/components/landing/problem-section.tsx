const stats = [
  { value: "91%", label: "accuracy reproducing faces" },
  { value: "47%", label: "AI ads using real faces" },
  { value: "0", label: "companies that notify people" },
];

export function ProblemSection() {
  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6 bg-[#0C1424]">
      <div className="max-w-6xl mx-auto">
        <p className="font-[family-name:var(--font-mono)] text-xs sm:text-sm font-medium uppercase tracking-widest text-[#EF4444] mb-4">
          The Problem
        </p>
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl text-white mb-12 sm:mb-16 max-w-3xl leading-tight">
          Imagine seeing yourself in an ad you never posed for.
        </h2>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {stats.map((stat) => (
            <div key={stat.value} className="border-l-2 border-[#DC2626] pl-6">
              <p className="text-4xl sm:text-5xl font-bold text-white mb-2">
                {stat.value}
              </p>
              <p className="font-[family-name:var(--font-outfit)] text-[#6A80A0] text-sm sm:text-base">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
