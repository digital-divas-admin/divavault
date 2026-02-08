"use client";

import { useState, useRef, useEffect } from "react";
import { LayoutGrid } from "lucide-react";

const apps = [
  {
    id: "madeofus",
    name: "Made Of Us",
    description: "Contributor platform",
    href: "/",
    current: true,
    color: "bg-primary",
    initials: "MU",
  },
  {
    id: "castmi",
    name: "castmi.ai",
    description: "AI generation",
    href: process.env.NEXT_PUBLIC_CASTMI_URL || "https://castmi.ai",
    current: false,
    color: "bg-secondary",
    initials: "CA",
    external: true,
  },
];

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
        aria-label="Switch apps"
      >
        <LayoutGrid className="h-5 w-5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-border/30 bg-card shadow-lg z-50">
          <div className="p-3 border-b border-border/20">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Apps
            </p>
          </div>
          <div className="p-2 space-y-1">
            {apps.map((app) => (
              <a
                key={app.id}
                href={app.external ? `${app.href}?sso_from=madeofus` : app.href}
                target={app.external ? "_blank" : undefined}
                rel={app.external ? "noopener noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                  app.current
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-accent/30 text-foreground"
                }`}
              >
                <div
                  className={`h-9 w-9 rounded-lg ${app.color} flex items-center justify-center text-white text-xs font-bold`}
                >
                  {app.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {app.name}
                    {app.current && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(current)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {app.description}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
