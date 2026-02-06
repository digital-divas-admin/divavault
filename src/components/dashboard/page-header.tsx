import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    icon?: LucideIcon;
    onClick?: () => void;
  };
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-bold">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm mt-1">{description}</p>
        )}
      </div>
      {action && (
        <Button
          asChild={!!action.href}
          onClick={action.onClick}
          className="shrink-0"
        >
          {action.href ? (
            <a href={action.href}>
              {action.icon && <action.icon className="h-4 w-4 mr-2" />}
              {action.label}
            </a>
          ) : (
            <>
              {action.icon && <action.icon className="h-4 w-4 mr-2" />}
              {action.label}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
