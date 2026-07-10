import { getBrawlerMeta } from "@/lib/data/brawlers";

interface TeamColumnProps {
  label: string;
  bans: string[];
  picks: string[];
  accentClassName: string;
}

function TeamColumn({ label, bans, picks, accentClassName }: TeamColumnProps) {
  return (
    <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <h3 className={`text-sm font-semibold ${accentClassName}`}>{label}</h3>
      <div className="mt-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Bans</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {bans.length === 0 && <span className="text-xs text-slate-600">none yet</span>}
          {bans.map((id) => (
            <span key={id} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400 line-through">
              {getBrawlerMeta(id)?.name ?? id}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Picks</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {picks.length === 0 && <span className="text-xs text-slate-600">none yet</span>}
          {picks.map((id) => (
            <span key={id} className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-100">
              {getBrawlerMeta(id)?.name ?? id}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DraftBoardProps {
  allyBans: string[];
  allyPicks: string[];
  enemyBans: string[];
  enemyPicks: string[];
}

export function DraftBoard({ allyBans, allyPicks, enemyBans, enemyPicks }: DraftBoardProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <TeamColumn label="Your Team" bans={allyBans} picks={allyPicks} accentClassName="text-blue-400" />
      <TeamColumn label="Enemy Team" bans={enemyBans} picks={enemyPicks} accentClassName="text-red-400" />
    </div>
  );
}
