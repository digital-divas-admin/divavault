import { ShieldCheck, Target, Gavel } from "lucide-react";

const stats = [
  {
    icon: ShieldCheck,
    value: "72,000+",
    label: "Images scanned across AI platforms",
  },
  {
    icon: Target,
    value: "17,000+",
    label: "Face embeddings indexed",
  },
  {
    icon: Gavel,
    value: "94%",
    label: "Takedown success rate",
  },
];

export function SocialProof() {
  return (
    <section className="section-elevated py-16 px-4 sm:py-24 sm:px-6">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground mb-10">
          Protection by the Numbers
        </p>

        <div className="grid sm:grid-cols-3 gap-8 mb-12">
          {stats.map((stat) => (
            <div key={stat.label}>
              <stat.icon className="w-8 h-8 text-primary mx-auto mb-3" />
              <p className="text-3xl sm:text-4xl font-bold mb-2">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <blockquote className="max-w-2xl mx-auto">
          <p className="text-lg sm:text-xl text-foreground/80 italic leading-relaxed">
            &ldquo;I had no idea my face was being used in AI-generated content
            until Made Of Us found 47 unauthorized models. They handled every
            takedown.&rdquo;
          </p>
          <footer className="mt-4 text-sm text-muted-foreground">
            — Sarah K., Content Creator
          </footer>
        </blockquote>
      </div>
    </section>
  );
}
