import { Radar, Gavel, Shield, Eye } from "lucide-react";

const props = [
  {
    icon: Radar,
    title: "Proactive Scanning",
    description:
      "We don't wait for you to find misuse. Our systems scan hundreds of AI platforms around the clock, searching for your face.",
  },
  {
    icon: Gavel,
    title: "Legal Muscle",
    description:
      "Automated DMCA takedowns backed by legal expertise. We handle the paperwork so you don't have to.",
  },
  {
    icon: Shield,
    title: "Your Data, Your Control",
    description:
      "Your photos and facial data are encrypted and never shared. You decide what gets scanned and when.",
  },
  {
    icon: Eye,
    title: "Transparent Results",
    description:
      "See every match, every takedown, every scan. Full visibility into what's happening with your likeness online.",
  },
];

export function ValueProps() {
  return (
    <section id="protection" className="section-elevated py-16 px-4 sm:py-24 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-center mb-4">
          Why Creators Trust{" "}
          <span className="text-primary">Made Of Us</span>
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-10 sm:mb-16">
          Real protection, real transparency, real results.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {props.map((prop) => (
            <div key={prop.title} className="text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mx-auto sm:mx-0">
                <prop.icon className="w-6 h-6 text-primary" />
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
