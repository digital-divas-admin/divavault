import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Shield, Heart } from "lucide-react";

const props = [
  {
    icon: DollarSign,
    title: "Fair Compensation",
    description:
      "Your likeness has value and you deserve to benefit from it. When our payment system launches, you'll be compensated for every dataset your photos contribute to. Early contributors will be first in line.",
  },
  {
    icon: Shield,
    title: "Identity Firewall",
    description:
      "Every contributor verifies their identity, so nobody can upload photos of someone else. This protects you and everyone on the platform.",
  },
  {
    icon: Heart,
    title: "Ethical-First Training",
    description:
      "Every single image on this platform was shared voluntarily, with informed consent. No scraping. No surprises. You know exactly how your photos are used.",
  },
];

export function ValueProps() {
  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-bold text-center mb-4">
          Why Creators Trust{" "}
          <span className="text-neon">Diva Vault</span>
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-10 sm:mb-16">
          We built the platform that puts creators first — real protection, real
          consent, real transparency.
        </p>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {props.map((prop) => (
            <Card
              key={prop.title}
              className="gradient-border bg-card/50 backdrop-blur-sm border-0 rounded-2xl"
            >
              <CardContent className="p-6 sm:p-8">
                <div className="w-12 h-12 rounded-xl bg-neon/10 flex items-center justify-center mb-6">
                  <prop.icon className="w-6 h-6 text-neon" />
                </div>
                <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold mb-3">
                  {prop.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {prop.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
