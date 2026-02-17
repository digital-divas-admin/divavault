interface SectionHeaderProps {
  label: string;
  title: string;
  description?: string;
}

export function SectionHeader({ label, title, description }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-primary mb-1">
        {label}
      </p>
      <h2 className="text-xl font-bold">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}
