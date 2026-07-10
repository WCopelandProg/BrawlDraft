import type { DraftState, Team } from "@/lib/draft-engine/types";

/**
 * Persists the single in-progress draft the user is currently running (spec section 3, item 15:
 * "continue using the most recent cached dataset" / general resilience — here specifically so a
 * reload doesn't lose an in-progress draft, per the end-to-end test list in the spec).
 */
export interface DraftSessionSnapshot {
  formatId: string;
  mapId: string;
  modeId: string;
  rankBucket: string;
  firstPickTeam: Team;
  profileId?: string;
  draftState: DraftState;
  updatedAt: string;
}

const STORAGE_KEY = "brawldraft.session.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadDraftSession(): DraftSessionSnapshot | undefined {
  if (!isBrowser()) return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as DraftSessionSnapshot;
  } catch {
    return undefined;
  }
}

export function saveDraftSession(snapshot: DraftSessionSnapshot): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }));
}

export function clearDraftSession(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
