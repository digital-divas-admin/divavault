import { HandHeart, DollarSign, Shield, Eye } from "lucide-react";

const props = [
  {
    icon: HandHeart,
    title: "Consent-First",
    description:
      "Every single image on this platform was shared voluntarily, with informed consent. No scraping. No surprises.",
  },
  {
    icon: DollarSign,
    title: "Fair Compensation",
    description:
      "Your likeness has value. When our payment system launches, you'll be compensated for every dataset your photos contribute to.",
  },
  {
    icon: Shield,
    title: "Privacy Protected",
    description:
      "Identity verification prevents impersonation. Your photos are encrypted in private storage and never shared publicly.",
  },
  {
    icon: Eye,
    title: "Full Transparency",
    description:
      "You know exactly how your photos are used. Review your consent in plain language and opt out anytime.",
  },
];

export function ValueProps() {
  return (
    <section id="why-join" className="section-dark py-16 px-4 sm:py-24 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-center mb-4">
          Why Creators Trust{" "}
          <span className="text-secondary">Made Of Us</span>
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-10 sm:mb-16">
          We built the platform that puts creators first — real protection, real
          consent, real transparency.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {props.map((prop) => (
            <div key={prop.title} className="text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center mb-4 mx-auto sm:mx-0">
                <prop.icon className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-[family-name:var(--font-heading)] text-lg mb-2">
                {prop.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
