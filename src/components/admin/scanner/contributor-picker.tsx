"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X } from "lucide-react";

interface ContributorResult {
  id: string;
  full_name: string | null;
  email: string;
  subscription_tier: string;
}

export interface SelectedContributor {
  id: string;
  name: string;
  email: string;
  tier: string;
}

interface ContributorPickerProps {
  selected: SelectedContributor | null;
  onSelect: (contributor: SelectedContributor | null) => void;
}

const tierColors: Record<string, string> = {
  free: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  protected: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  premium: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

export function ContributorPicker({ selected, onSelect }: ContributorPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContributorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/scanner/search-contributors?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setResults(data.contributors || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelect(c: ContributorResult) {
    onSelect({
      id: c.id,
      name: c.full_name || c.email,
      email: c.email,
      tier: c.subscription_tier,
    });
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onSelect(null);
    setQuery("");
    setResults([]);
  }

  if (selected) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{selected.name}</p>
            <Badge className={`text-[10px] ${tierColors[selected.tier] || tierColors.free}`}>
              {selected.tier}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{selected.email}</p>
        </div>
        <button
          onClick={handleClear}
          className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9 pr-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border/30 bg-card shadow-lg max-h-64 overflow-auto">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {c.full_name || "No name"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.email}
                </p>
              </div>
              <Badge className={`text-[10px] shrink-0 ${tierColors[c.subscription_tier] || tierColors.free}`}>
                {c.subscription_tier}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border/30 bg-card shadow-lg p-3 text-center text-sm text-muted-foreground">
          No contributors found
        </div>
      )}
    </div>
  );
}
