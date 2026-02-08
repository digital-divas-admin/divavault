import { ExternalLink } from "lucide-react";

export function SocialProof() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground mb-6">
          In the Press
        </p>
        <a
          href="https://www.businessinsider.com/ai-influencer-modeling-vixxxen-2024-6"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-5 py-3 sm:px-8 sm:py-4 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors group"
        >
          <span className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl md:text-3xl text-foreground/80 group-hover:text-foreground transition-colors">
            Business Insider
          </span>
          <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </a>
        <p className="mt-4 text-sm text-muted-foreground">
          Built by the team at{" "}
          <span className="text-primary font-semibold">vixxxen.ai</span>
        </p>
      </div>
    </section>
  );
}
