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
