import type { InvestigationCategory } from "@/types/investigations";
import { InvestigationCard } from "@/components/investigations/investigation-card";
import { getRelatedInvestigations } from "@/lib/investigation-queries";

interface RelatedInvestigationsProps {
  currentId: string;
  category: InvestigationCategory;
}

export async function RelatedInvestigations({ currentId, category }: RelatedInvestigationsProps) {
  const related = await getRelatedInvestigations(currentId, category);
  if (related.length === 0) return null;

  return (
    <section>
      <h2 className="font-[family-name:var(--font-heading)] text-2xl text-foreground mb-6">
        Related Investigations
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {related.map((inv) => (
          <InvestigationCard key={inv.id} investigation={inv} />
        ))}
      </div>
    </section>
  );
}
