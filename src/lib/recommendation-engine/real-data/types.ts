/**
 * One row of real data imported from a brawltime.ninja CSV export (see
 * data/brawltime/README.md for how the export is produced and imported). This is the on-disk
 * shape stored in generated-map-stats.json — deliberately flatter than the engine's MapStatRecord
 * so the import script stays simple; hybrid-dataset.ts converts it into a real MapStatRecord at
 * read time.
 */
export interface ImportedMapStatRow {
  brawlerId: string;
  mapId: string;
  modeId: string;
  rankBucket: string;
  /** 0-1 fraction, not a 0-100 percentage. */
  winRate: number;
  /** 0-1 fraction if the export included a use-rate column, otherwise omitted. */
  useRate?: number;
  /**
   * brawltime.ninja's CSV export (as of this writing) does not include a per-Brawler sample
   * size — only a page-level aggregate ("Sample Size: 2.81M Battles"). Rather than fabricate a
   * precise number, the import script applies one conservative, explicitly-provided sample size
   * to every row from a given export (see --sample-size in the import script). This is real
   * data with an approximated confidence input, not a fabricated statistic.
   */
  sampleSize: number;
  /** ISO date the CSV was exported, so staleness is visible in the UI. */
  exportedAt: string;
  /** Free-text note, e.g. the source URL/filter description, kept for auditability. */
  sourceNote?: string;
}

/**
 * One row of real, global (not map-specific) pick-rate data imported from a brawltime.ninja CSV
 * export, e.g. "general pick rate for all ranked matches from Legendary to Masters". Pick rate
 * measures popularity — how often players choose this Brawler — not measured win rate/strength,
 * and is never written into MapStatRecord.adjustedWinRate; see hybrid-dataset.ts for how it's
 * actually used (a separate, honestly-labeled "real meta popularity" signal).
 */
export interface ImportedPickRateRow {
  brawlerId: string;
  rankBucket: string;
  /** 0-1 fraction, exactly as exported (typically small, e.g. 0.05 for the most-picked Brawler). */
  pickRate: number;
  /**
   * 0-1, this Brawler's rank among every Brawler in the same import by pick rate (1.0 = most
   * picked in the export, 0.0 = least picked). Precomputed at import time since raw pick-rate
   * fractions are hard to compare directly to the rest of this app's 0-1-normalized signals.
   */
  popularityPercentile: number;
  exportedAt: string;
  sourceNote?: string;
}

/**
 * One row of real, per-mode (not rank-bucket-scoped) use-rate data, imported by
 * scripts/import-mode-userate-csv.mjs. The source CSVs this was built against gave a use-rate
 * breakdown per game mode (all maps combined) but didn't state which rank bracket they came from,
 * so — rather than guess one — this is applied uniformly across every rank bucket for the given
 * mode, and `sourceNote` records that the rank bracket is unstated so it stays auditable.
 */
export interface ImportedModeUseRateRow {
  brawlerId: string;
  modeId: string;
  /** 0-1 fraction, exactly as exported. */
  useRate: number;
  /** 0-1, this Brawler's rank among every Brawler in the same mode's import by use rate. */
  popularityPercentile: number;
  exportedAt: string;
  sourceNote?: string;
}
