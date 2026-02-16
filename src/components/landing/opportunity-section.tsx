"use client";

import { useState } from "react";

const categories = [
  { name: "Commercial", pct: 40, rate: 0.08 },
  { name: "Social Media", pct: 35, rate: 0.04 },
  { name: "Editorial", pct: 15, rate: 0.03 },
  { name: "E-commerce", pct: 10, rate: 0.05 },
];

const REV_SHARE = 0.7;

function calcEarnings(generations: number) {
  return categories.reduce((total, cat) => {
    const catGenerations = generations * (cat.pct / 100);
    return total + catGenerations * cat.rate * REV_SHARE;
  }, 0);
}

export function OpportunitySection() {
  const [generations, setGenerations] = useState(500);
  const total = calcEarnings(generations);

  return (
    <section className="py-16 px-4 sm:py-24 sm:px-6 bg-[#F8FAFD]">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs sm:text-sm font-medium uppercase tracking-widest text-[#F59E0B] mb-4">
              The Opportunity
            </p>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-[#0C1424] mb-6 leading-tight">
              Protection that pays you back.
            </h2>
            <p className="font-[family-name:var(--font-outfit)] text-[#3A5070] text-base sm:text-lg leading-relaxed max-w-lg">
              When companies want to use AI-generated likenesses ethically, they license through our marketplace. You set the terms. You earn from every generation. Your face, your rules, your revenue.
            </p>
          </div>

          {/* Right: earnings calculator */}
          <div className="bg-white rounded-2xl border border-[#D0D8E6] p-6 sm:p-8 shadow-sm">
            <h3 className="font-[family-name:var(--font-heading)] text-xl text-[#0C1424] mb-6">
              Earnings Calculator
            </h3>

            {/* Slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="font-[family-name:var(--font-outfit)] text-sm text-[#3A5070]">
                  Monthly AI Generations
                </label>
                <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-[#0C1424]">
                  {generations.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={5000}
                step={50}
                value={generations}
                onChange={(e) => setGenerations(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[#DEE6F2] accent-[#DC2626]"
              />
              <div className="flex justify-between text-xs text-[#6A80A0] mt-1">
                <span>50</span>
                <span>5,000</span>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="space-y-3 mb-6">
              {categories.map((cat) => {
                const catEarnings = generations * (cat.pct / 100) * cat.rate * REV_SHARE;
                return (
                  <div key={cat.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-[family-name:var(--font-outfit)] text-sm text-[#3A5070]">
                        {cat.name}
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-xs text-[#6A80A0]">
                        {cat.pct}%
                      </span>
                    </div>
                    <span className="font-[family-name:var(--font-mono)] text-sm text-[#0C1424]">
                      ${catEarnings.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="border-t border-[#D0D8E6] pt-4 flex items-center justify-between">
              <span className="font-[family-name:var(--font-outfit)] font-medium text-[#0C1424]">
                Estimated Monthly
              </span>
              <span className="text-2xl font-bold text-[#F59E0B]">
                ${total.toFixed(2)}
              </span>
            </div>

            <p className="font-[family-name:var(--font-outfit)] text-xs text-[#6A80A0] mt-3">
              Based on 70% revenue share. Actual earnings vary.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
