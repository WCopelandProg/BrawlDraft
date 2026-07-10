"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DRAFT_FORMATS } from "@/lib/draft-engine/formats";
import { reset } from "@/lib/draft-engine/engine";
import type { Team } from "@/lib/draft-engine/types";
import { GAME_MODES } from "@/lib/data/modes";
import { mapsForMode } from "@/lib/data/maps";
import { BRAWLERS } from "@/lib/data/brawlers";
import { createProfile, loadProfiles, upsertProfile, type PlayerProfile } from "@/lib/storage/profiles";
import { saveDraftSession } from "@/lib/storage/draft-session";

const RANK_BUCKETS = ["all", "diamond", "mythic", "legendary", "masters"];

export default function SetupScreen() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("guest");
  const [newProfileLabel, setNewProfileLabel] = useState("");
  const [newProfileTag, setNewProfileTag] = useState("");

  const [formatId, setFormatId] = useState(DRAFT_FORMATS[1]!.id);
  const [modeId, setModeId] = useState(GAME_MODES[0]!.id);
  const [mapId, setMapId] = useState(mapsForMode(GAME_MODES[0]!.id)[0]?.id ?? "");
  const [firstPickTeam, setFirstPickTeam] = useState<Team>("ally");
  const [rankBucket, setRankBucket] = useState("all");

  useEffect(() => {
    setProfiles(loadProfiles());
  }, []);

  const mapsForSelectedMode = useMemo(() => mapsForMode(modeId), [modeId]);
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  function handleModeChange(nextModeId: string) {
    setModeId(nextModeId);
    const firstMap = mapsForMode(nextModeId)[0];
    if (firstMap) setMapId(firstMap.id);
  }

  function handleCreateProfile() {
    if (!newProfileLabel.trim()) return;
    const profile = createProfile(newProfileLabel.trim(), newProfileTag.trim() || undefined);
    setProfiles((prev) => [...prev, profile]);
    setSelectedProfileId(profile.id);
    setNewProfileLabel("");
    setNewProfileTag("");
  }

  function toggleBrawlerExcluded(brawlerId: string) {
    if (!selectedProfile) return;
    const excluded = new Set(selectedProfile.manuallyExcludedBrawlerIds);
    if (excluded.has(brawlerId)) excluded.delete(brawlerId);
    else excluded.add(brawlerId);
    const updated = { ...selectedProfile, manuallyExcludedBrawlerIds: [...excluded] };
    upsertProfile(updated);
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function toggleBrawlerUnlocked(brawlerId: string) {
    if (!selectedProfile) return;
    const unlocked = new Set(selectedProfile.unlockedBrawlerIds);
    if (unlocked.has(brawlerId)) unlocked.delete(brawlerId);
    else unlocked.add(brawlerId);
    const updated = { ...selectedProfile, unlockedBrawlerIds: [...unlocked] };
    upsertProfile(updated);
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleStartDraft() {
    const format = DRAFT_FORMATS.find((f) => f.id === formatId);
    if (!format || !mapId) return;
    const draftState = reset(format);
    saveDraftSession({
      formatId,
      mapId,
      modeId,
      rankBucket,
      firstPickTeam,
      profileId: selectedProfileId === "guest" ? undefined : selectedProfileId,
      draftState,
      updatedAt: new Date().toISOString(),
    });
    router.push("/draft");
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-50">BrawlDraft</h1>
        <p className="text-sm text-slate-400">Ranked draft assistant &mdash; set up your draft below.</p>
      </header>

      <section aria-labelledby="profile-heading" className="space-y-3">
        <h2 id="profile-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Player profile
        </h2>
        <select
          value={selectedProfileId}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="guest">Guest (no saved profile)</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.playerTag ? ` (${p.playerTag})` : ""}
            </option>
          ))}
        </select>

        <div className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-900/50 p-3 sm:flex-row">
          <input
            type="text"
            placeholder="Profile name (e.g. Main account)"
            value={newProfileLabel}
            onChange={(e) => setNewProfileLabel(e.target.value)}
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <input
            type="text"
            placeholder="Player tag (optional, manual)"
            value={newProfileTag}
            onChange={(e) => setNewProfileTag(e.target.value)}
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={handleCreateProfile}
            className="min-h-[44px] rounded-md bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-yellow-400"
          >
            Save profile
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Player tags are not looked up automatically yet (no live API integration in this build &mdash; see
          docs/discovery.md). Edit your available Brawlers manually below.
        </p>

        {selectedProfile && (
          <details className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-200">
              Edit available Brawlers for {selectedProfile.label}
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {BRAWLERS.map((b) => {
                const unlocked = selectedProfile.unlockedBrawlerIds.includes(b.id);
                const excluded = selectedProfile.manuallyExcludedBrawlerIds.includes(b.id);
                return (
                  <div key={b.id} className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1.5 text-xs">
                    <span className={excluded ? "text-slate-500 line-through" : "text-slate-200"}>{b.name}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => toggleBrawlerUnlocked(b.id)}
                        className="rounded px-1.5 py-0.5 text-[10px]"
                        title="Toggle unlocked"
                        style={{ background: unlocked ? "#166534" : "#334155" }}
                      >
                        {unlocked ? "Unlocked" : "Locked"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBrawlerExcluded(b.id)}
                        className="rounded px-1.5 py-0.5 text-[10px]"
                        title="Toggle manually excluded"
                        style={{ background: excluded ? "#7f1d1d" : "#334155" }}
                      >
                        {excluded ? "Excluded" : "Include"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="format-heading" className="space-y-3">
        <h2 id="format-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Ranked format
        </h2>
        <select
          value={formatId}
          onChange={(e) => setFormatId(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          {DRAFT_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          {DRAFT_FORMATS.find((f) => f.id === formatId)?.description}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="mode-select" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Game mode
          </label>
          <select
            id="mode-select"
            value={modeId}
            onChange={(e) => handleModeChange(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {GAME_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="map-select" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Map
          </label>
          <select
            id="map-select"
            value={mapId}
            onChange={(e) => setMapId(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {mapsForSelectedMode.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            First pick team
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFirstPickTeam("ally")}
              className={`min-h-[44px] flex-1 rounded-md border px-3 py-2 text-sm font-medium ${firstPickTeam === "ally" ? "border-blue-400 bg-blue-500/20 text-blue-200" : "border-slate-700 bg-slate-900 text-slate-300"}`}
            >
              Your team
            </button>
            <button
              type="button"
              onClick={() => setFirstPickTeam("enemy")}
              className={`min-h-[44px] flex-1 rounded-md border px-3 py-2 text-sm font-medium ${firstPickTeam === "enemy" ? "border-red-400 bg-red-500/20 text-red-200" : "border-slate-700 bg-slate-900 text-slate-300"}`}
            >
              Enemy team
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="rank-select" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Rank bracket (optional)
          </label>
          <select
            id="rank-select"
            value={rankBucket}
            onChange={(e) => setRankBucket(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {RANK_BUCKETS.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? "All ranks" : r[0]!.toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <button
        type="button"
        onClick={handleStartDraft}
        disabled={!mapId}
        className="min-h-[48px] rounded-md bg-yellow-500 px-4 py-3 text-base font-bold text-slate-950 hover:bg-yellow-400 disabled:opacity-50"
      >
        Start Draft
      </button>
    </main>
  );
}
