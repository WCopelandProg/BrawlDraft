import { BRAWLER_IDS } from "@/lib/data/brawlers";

/**
 * Guest-mode, localStorage-backed player profiles (spec section 3, item 4: "Save one or more
 * player profiles locally or in an account" + "Do not block the core draft tool on authentication").
 * No network calls happen here — playerTag is a free-text field the user can fill in by hand for
 * their own reference; it is NOT looked up against the official API in this delivery (that's
 * Phase 3, and requires a server-side proxy per docs/architecture.md section 3).
 */
export interface PlayerProfile {
  id: string;
  label: string;
  playerTag?: string;
  unlockedBrawlerIds: string[];
  underleveledBrawlerIds: string[];
  manuallyExcludedBrawlerIds: string[];
  /**
   * Remembered so picking a profile on the setup screen also restores the rank bracket in one
   * step — the draft timer is short, so re-entering it every time isn't acceptable. Still
   * overridable per draft (rank can change between sessions).
   */
  defaultRankBucket?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "brawldraft.profiles.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadProfiles(): PlayerProfile[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveProfiles(profiles: PlayerProfile[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function createProfile(label: string, playerTag?: string): PlayerProfile {
  const now = new Date().toISOString();
  const profile: PlayerProfile = {
    id: `profile-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    label,
    playerTag,
    unlockedBrawlerIds: [...BRAWLER_IDS],
    underleveledBrawlerIds: [],
    manuallyExcludedBrawlerIds: [],
    defaultRankBucket: "all",
    createdAt: now,
    updatedAt: now,
  };
  const profiles = loadProfiles();
  saveProfiles([...profiles, profile]);
  return profile;
}

export function upsertProfile(profile: PlayerProfile): void {
  const profiles = loadProfiles();
  const index = profiles.findIndex((p) => p.id === profile.id);
  const updated = { ...profile, updatedAt: new Date().toISOString() };
  if (index === -1) {
    saveProfiles([...profiles, updated]);
  } else {
    const next = [...profiles];
    next[index] = updated;
    saveProfiles(next);
  }
}

export function deleteProfile(id: string): void {
  saveProfiles(loadProfiles().filter((p) => p.id !== id));
}
