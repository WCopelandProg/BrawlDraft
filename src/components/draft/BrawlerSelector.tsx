"use client";

import { useMemo, useState } from "react";
import { BRAWLERS } from "@/lib/data/brawlers";
import { getBrawlerClassLabel } from "@/lib/recommendation-engine/class-counters";

interface BrawlerSelectorProps {
  /** Brawler ids that must not be selectable (already banned or picked). */
  excludedBrawlerIds: string[];
  onSelect: (brawlerId: string) => void;
  /** If provided, ids outside this set render with an "unavailable" badge but remain clickable. */
  availableBrawlerIds?: string[];
  disabled?: boolean;
  label: string;
}

export function BrawlerSelector({
  excludedBrawlerIds,
  onSelect,
  availableBrawlerIds,
  disabled,
  label,
}: BrawlerSelectorProps) {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const excluded = new Set(excludedBrawlerIds);
    const q = query.trim().toLowerCase();
    return BRAWLERS.filter((b) => !excluded.has(b.id) && (q === "" || b.name.toLowerCase().includes(q)));
  }, [excludedBrawlerIds, query]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <label htmlFor={`brawler-search-${label}`} className="sr-only">
        Search Brawlers for {label}
      </label>
      <input
        id={`brawler-search-${label}`}
        type="text"
        inputMode="search"
        placeholder={`Search Brawlers to ${label.toLowerCase()}…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        className="mb-2 w-full min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-50"
      />
      <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3" role="listbox" aria-label={label}>
        {options.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-500">No Brawlers match.</p>}
        {options.map((b) => {
          const isAvailable = !availableBrawlerIds || availableBrawlerIds.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={false}
              disabled={disabled}
              onClick={() => onSelect(b.id)}
              className="flex min-h-[44px] flex-col items-start justify-center rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm font-medium text-slate-100 transition hover:border-yellow-400 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{b.name}</span>
              <span className="text-[10px] font-normal text-slate-400">{getBrawlerClassLabel(b.id) ?? "Unclassified"}</span>
              {!isAvailable && <span className="text-[10px] font-normal text-amber-400">not in your pool</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
