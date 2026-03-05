export function ExecutiveSummary({ summary }: { summary: string }) {
  return (
    <section className="bg-card border border-border rounded-xl p-6 sm:p-8">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Executive Summary
      </span>
      <div className="border-l-4 border-primary pl-6 mt-4">
        <p className="executive-summary-text text-base sm:text-lg leading-relaxed text-foreground whitespace-pre-wrap">
          {summary}
        </p>
      </div>
    </section>
  );
}
