interface StepContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function StepContainer({
  title,
  description,
  children,
}: StepContainerProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-bold mb-2">
          {title}
        </h2>
        <p className="text-muted-foreground">{description}</p>
        <p className="text-xs text-trust-muted mt-1">
          Your progress is saved automatically. You can leave and come back
          anytime.
        </p>
      </div>
      {children}
    </div>
  );
}
