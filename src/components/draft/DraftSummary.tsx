import type { DraftAnalysis, TeamDraftGrade } from "@/lib/recommendation-engine/draft-analysis";

interface DraftSummaryProps {
  analysis: DraftAnalysis;
}

function scoreColor(score: number): string {
  if (score >= 65) return "text-emerald-400";
  if (score >= 50) return "text-yellow-300";
  if (score >= 35) return "text-amber-400";
  return "text-rose-400";
}

function WinProbabilityBar({ ally, enemy }: { ally: TeamDraftGrade; enemy: TeamDraftGrade }) {
  const allyPct = Math.round(ally.winProbability * 100);
  const enemyPct = 100 - allyPct;
  return (
    <div>
      <div className="flex justify-between text-xs font-medium text-slate-300">
        <span>Your team {allyPct}%</span>
        <span>Enemy team {enemyPct}%</span>
      </div>
      <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-slate-800" role="img" aria-label={`Estimated win probability: your team ${allyPct}%, enemy team ${enemyPct}%`}>
        <div className="h-full bg-blue-500" style={{ width: `${allyPct}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${enemyPct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        A heuristic estimate from this app's own curated/real scoring signals — not a calibrated
        win-probability model.
      </p>
    </div>
  );
}

function ReasonList({ items, tone }: { items: TeamDraftGrade["strengths"] | TeamDraftGrade["tips"]; tone: "positive" | "negative" }) {
  if (items.length === 0) return null;
  return (
    <ul className={`space-y-1 text-xs ${tone === "positive" ? "text-slate-300" : "text-rose-300"}`}>
      {items.map((item, i) => (
        <li key={`${item.type}-${i}`} className="flex gap-1.5">
          <span aria-hidden className={tone === "positive" ? "text-emerald-400" : ""}>
            {tone === "positive" ? "+" : "!"}
          </span>
          <span>{item.message}</span>
        </li>
      ))}
    </ul>
  );
}

export function DraftSummary({ analysis }: DraftSummaryProps) {
  const { ally, enemy } = analysis;
  return (
    <div className="space-y-4 rounded-lg border border-emerald-800 bg-emerald-950/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Your draft score</p>
          <p className={`text-4xl font-bold ${scoreColor(ally.score)}`}>{ally.score}</p>
          <p className="text-sm font-medium text-slate-300">{ally.scoreLabel}</p>
        </div>
      </div>

      <WinProbabilityBar ally={ally} enemy={enemy} />

      {ally.strengths.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What went well</p>
          <ReasonList items={ally.strengths} tone="positive" />
        </div>
      )}

      {ally.tips.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tips for improvement</p>
          <ReasonList items={ally.tips} tone="negative" />
        </div>
      )}
    </div>
  );
}
