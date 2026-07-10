import { getBrawlerMeta } from "@/lib/data/brawlers";
import type { BrawlerRecommendation } from "@/lib/recommendation-engine/types";

interface RecommendationListProps {
  title: string;
  recommendations: BrawlerRecommendation[];
  limit?: number;
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.65) return "High confidence";
  if (confidence >= 0.4) return "Moderate confidence";
  return "Low confidence";
}

export function RecommendationList({ title, recommendations, limit = 5 }: RecommendationListProps) {
  const shown = recommendations.slice(0, limit);

  if (shown.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
        No recommendations available for this step.
      </div>
    );
  }

  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <ol className="space-y-2">
        {shown.map((rec, index) => {
          const meta = getBrawlerMeta(rec.brawlerId);
          return (
            <li
              key={rec.brawlerId}
              className="rounded-lg border border-slate-800 bg-slate-900 p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="mr-2 text-xs text-slate-500">#{index + 1}</span>
                  <span className="font-semibold text-slate-50">{meta?.name ?? rec.brawlerId}</span>
                  <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                    {rec.action}
                  </span>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div className="font-mono text-sm text-slate-100">{Math.round(rec.score * 100)}</div>
                  <div>{confidenceLabel(rec.confidence)}</div>
                </div>
              </div>
              {rec.availability !== "unlocked_eligible" && rec.availability !== "unknown" && (
                <p className="mt-1 text-[11px] text-amber-400">
                  {rec.availability === "not_unlocked" && "Not unlocked for this player"}
                  {rec.availability === "manually_excluded" && "Manually excluded"}
                  {rec.availability === "unlocked_underleveled" && "Unlocked but underleveled"}
                  {rec.availability === "temporarily_eligible" && "Temporarily eligible"}
                </p>
              )}
              {rec.reasons.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {rec.reasons.map((reason) => (
                    <li key={reason.type} className="flex gap-1.5">
                      <span aria-hidden className="text-emerald-400">
                        +
                      </span>
                      <span>{reason.message}</span>
                    </li>
                  ))}
                </ul>
              )}
              {rec.warnings.length > 0 && (
                <ul className="mt-1 space-y-1 text-xs text-rose-300">
                  {rec.warnings.map((warning) => (
                    <li key={warning.type} className="flex gap-1.5">
                      <span aria-hidden>!</span>
                      <span>{warning.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
