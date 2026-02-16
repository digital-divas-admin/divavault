"use client";

import { useState } from "react";

interface ConsentToggle {
  id: string;
  label: string;
  defaultOn: boolean;
}

const TOGGLES: ConsentToggle[] = [
  { id: "commercial", label: "Commercial Advertising", defaultOn: true },
  { id: "social", label: "Social Media Content", defaultOn: true },
  { id: "editorial", label: "Editorial & News", defaultOn: false },
  { id: "political", label: "Political Campaigns", defaultOn: false },
  { id: "healthcare", label: "Healthcare / Medical", defaultOn: true },
  { id: "entertainment", label: "Entertainment & Film", defaultOn: true },
];

export function MarketplaceSection() {
  const [states, setStates] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TOGGLES.map((t) => [t.id, t.defaultOn]))
  );

  const toggle = (id: string) =>
    setStates((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6 bg-[#F0F4FA]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <p className="font-[family-name:var(--font-mono)] text-xs sm:text-sm font-medium uppercase tracking-widest text-[#F59E0B] mb-4">
            The Marketplace
          </p>
          <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-[#0C1424] mb-4 leading-tight">
            You decide how your face is used.
          </h2>
          <p className="font-[family-name:var(--font-outfit)] text-[#3A5070] max-w-2xl mx-auto text-base sm:text-lg">
            Granular consent controls let you choose exactly which industries can license your likeness. Toggle categories on or off at any time.
          </p>
        </div>

        {/* Consent Control Panel */}
        <div className="bg-[#0C1424] rounded-2xl p-6 sm:p-8 max-w-lg mx-auto">
          <h3 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[#6A80A0] mb-6">
            Consent Control Panel
          </h3>

          <div className="space-y-4">
            {TOGGLES.map((t) => {
              const isOn = states[t.id];
              return (
                <div key={t.id} className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-outfit)] text-sm text-white/90">
                    {t.label}
                  </span>
                  <button
                    role="switch"
                    aria-checked={isOn}
                    aria-label={`Toggle ${t.label}`}
                    onClick={() => toggle(t.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                      isOn ? "bg-emerald-500" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        isOn ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <p className="font-[family-name:var(--font-outfit)] text-xs text-[#6A80A0] mt-6">
            Changes take effect immediately. Revoke anytime.
          </p>
        </div>
      </div>
    </section>
  );
}
