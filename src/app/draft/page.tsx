"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyAction,
  bannedBrawlerIds,
  getLegalSteps,
  isComplete,
  pickedBrawlerIds,
  reset,
  teamBans,
  teamPicks,
  undo,
} from "@/lib/draft-engine/engine";
import { getDraftFormat, resolveFormatForFirstPick } from "@/lib/draft-engine/formats";
import type { DraftState, Team } from "@/lib/draft-engine/types";
import { BRAWLER_IDS } from "@/lib/data/brawlers";
import { getGameModeMeta } from "@/lib/data/modes";
import { getMapMeta } from "@/lib/data/maps";
import { getRankBucketMeta } from "@/lib/data/ranks";
import { generatePickRecommendations, splitByAvailability } from "@/lib/recommendation-engine/engine";
import { generateBanRecommendations } from "@/lib/recommendation-engine/ban";
import { MOCK_DATASET } from "@/lib/recommendation-engine/mock-data";
import type { DraftRecommendationContext } from "@/lib/recommendation-engine/types";
import { loadProfiles, type PlayerProfile } from "@/lib/storage/profiles";
import { clearDraftSession, loadDraftSession, saveDraftSession } from "@/lib/storage/draft-session";
import { BrawlerSelector } from "@/components/draft/BrawlerSelector";
import { DraftBoard } from "@/components/draft/DraftBoard";
import { RecommendationList } from "@/components/draft/RecommendationList";

const KNOWN_BRAWLER_IDS = new Set(BRAWLER_IDS);

export default function DraftScreen() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof loadDraftSession>>(undefined);
  const [state, setState] = useState<DraftState | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadDraftSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
    setState(s.draftState);
    if (s.profileId) {
      const found = loadProfiles().find((p) => p.id === s.profileId);
      setProfile(found);
    }
    setLoaded(true);
  }, [router]);

  const format = useMemo(() => (session ? getDraftFormat(session.formatId) : undefined), [session]);
  const resolvedFormat = useMemo(
    () => (format && session ? resolveFormatForFirstPick(format, session.firstPickTeam) : undefined),
    [format, session],
  );

  const legalSteps = state && resolvedFormat ? getLegalSteps(state, resolvedFormat) : [];
  const complete = state && resolvedFormat ? isComplete(state, resolvedFormat) : false;
  const banned = state ? bannedBrawlerIds(state) : [];
  const picked = state ? pickedBrawlerIds(state) : [];
  const allyBans = state ? teamBans(state, "ally") : [];
  const enemyBans = state ? teamBans(state, "enemy") : [];
  const allyPicks = state ? teamPicks(state, "ally") : [];
  const enemyPicks = state ? teamPicks(state, "enemy") : [];

  const allyLegal = legalSteps.filter((s) => s.team === "ally");
  const enemyLegal = legalSteps.filter((s) => s.team === "enemy");
  const isSimultaneousPhase = Boolean(legalSteps[0]?.simultaneousGroup);
  const currentActionType = legalSteps[0]?.action;

  function persist(nextState: DraftState) {
    if (!session) return;
    setState(nextState);
    saveDraftSession({ ...session, draftState: nextState });
    setError(null);
  }

  function handleSelect(brawlerId: string, team: Team, action: "ban" | "pick") {
    if (!state || !resolvedFormat) return;
    const result = applyAction(state, resolvedFormat, { team, action, brawlerId }, { knownBrawlerIds: KNOWN_BRAWLER_IDS });
    if (!result.ok) {
      setError(result.result.message ?? "That action is not legal right now.");
      return;
    }
    persist(result.state);
  }

  function handleUndo() {
    if (!state) return;
    persist(undo(state));
  }

  function handleReset() {
    if (!resolvedFormat) return;
    persist(reset(resolvedFormat));
  }

  function handleNewSetup() {
    clearDraftSession();
    router.push("/");
  }

  const recommendationContext: DraftRecommendationContext | undefined =
    session && resolvedFormat
      ? {
          mapId: session.mapId,
          modeId: session.modeId,
          rankBucket: session.rankBucket,
          team: "ally",
          action: currentActionType ?? "pick",
          allyPicks,
          enemyPicks,
          allBanned: banned,
          allPicked: picked,
          picksSoFar: picked.length,
          totalPicksInFormat: resolvedFormat.steps.filter((s) => s.action === "pick").length,
          playerPool: profile
            ? {
                unlockedBrawlerIds: profile.unlockedBrawlerIds,
                manuallyExcludedBrawlerIds: profile.manuallyExcludedBrawlerIds,
                underleveledBrawlerIds: profile.underleveledBrawlerIds,
              }
            : undefined,
        }
      : undefined;

  const showAllyRecommendations = allyLegal.length > 0 && recommendationContext && !complete;
  const recommendations = showAllyRecommendations
    ? currentActionType === "ban"
      ? generateBanRecommendations(recommendationContext!, MOCK_DATASET)
      : generatePickRecommendations(recommendationContext!, MOCK_DATASET)
    : [];
  const { available: availableRecs, unavailable: unavailableRecs } =
    currentActionType === "pick" ? splitByAvailability(recommendations) : { available: recommendations, unavailable: [] };

  const isFinalPickOfDraft =
    currentActionType === "pick" &&
    recommendationContext !== undefined &&
    recommendationContext.totalPicksInFormat - recommendationContext.picksSoFar === 1;

  if (!loaded || !session || !resolvedFormat || !state) {
    return <main className="px-4 py-6 text-slate-300">Loading draft…</main>;
  }

  const mapMeta = getMapMeta(session.mapId);
  const modeMeta = getGameModeMeta(session.modeId);
  const rankBucketMeta = getRankBucketMeta(session.rankBucket);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-50">
            {mapMeta?.name ?? session.mapId} &middot; {modeMeta?.name ?? session.modeId}
          </h1>
          <p className="text-xs text-slate-500">
            Dataset: {MOCK_DATASET.versionId} (seeded/mock) &middot; Patch: {MOCK_DATASET.patchId} &middot; Rank:{" "}
            {rankBucketMeta?.name ?? session.rankBucket}
          </p>
          <p className="text-xs text-slate-500">Format: {resolvedFormat.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={state.history.length === 0}
            className="min-h-[40px] rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[40px] rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200"
          >
            Reset
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-md border border-rose-800 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <DraftBoard allyBans={allyBans} allyPicks={allyPicks} enemyBans={enemyBans} enemyPicks={enemyPicks} />

      {complete ? (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-center">
          <p className="font-semibold text-emerald-300">Draft complete.</p>
          <button
            type="button"
            onClick={handleNewSetup}
            className="mt-3 min-h-[44px] rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-yellow-400"
          >
            Start a new draft
          </button>
        </div>
      ) : (
        <>
          <div
            aria-live="polite"
            className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200"
          >
            {isSimultaneousPhase
              ? "Ban phase: enter both teams' bans as they're revealed."
              : `Current turn: ${legalSteps[0]?.team === "ally" ? "Your team" : "Enemy team"} to ${legalSteps[0]?.action}.`}
          </div>

          {isSimultaneousPhase ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                {allyLegal.length > 0 ? (
                  <BrawlerSelector
                    label="Your ban"
                    excludedBrawlerIds={[...banned, ...picked]}
                    onSelect={(id) => handleSelect(id, "ally", "ban")}
                  />
                ) : (
                  <p className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-400">
                    Your bans are locked in.
                  </p>
                )}
              </div>
              <div className="flex-1">
                {enemyLegal.length > 0 ? (
                  <BrawlerSelector
                    label="Enemy ban"
                    excludedBrawlerIds={[...banned, ...picked]}
                    onSelect={(id) => handleSelect(id, "enemy", "ban")}
                  />
                ) : (
                  <p className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-400">
                    Enemy bans are locked in.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <BrawlerSelector
              label={`${legalSteps[0]?.team === "ally" ? "your" : "enemy"} ${legalSteps[0]?.action}`}
              excludedBrawlerIds={[...banned, ...picked]}
              availableBrawlerIds={
                legalSteps[0]?.team === "ally" && profile
                  ? profile.unlockedBrawlerIds.filter((id) => !profile.manuallyExcludedBrawlerIds.includes(id))
                  : undefined
              }
              onSelect={(id) => handleSelect(id, legalSteps[0]!.team, legalSteps[0]!.action)}
            />
          )}

          {showAllyRecommendations && (
            <>
              {isFinalPickOfDraft && (
                <p className="rounded-md border border-yellow-700/50 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-200">
                  Last pick of the draft &mdash; the enemy comp is fully revealed, so recommendations now
                  prioritize direct counters over general flexibility.
                </p>
              )}
              <RecommendationList
                title={currentActionType === "ban" ? "Recommended bans" : "Recommended picks"}
                recommendations={availableRecs}
              />
              {unavailableRecs.length > 0 && (
                <details className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Ideal but unavailable to you
                  </summary>
                  <div className="mt-2">
                    <RecommendationList title="" recommendations={unavailableRecs} limit={3} />
                  </div>
                </details>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
