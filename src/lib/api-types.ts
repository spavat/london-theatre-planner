import type { Slot, scrapeRuns, scrapeShowResults } from "@/db/schema";

export interface ShowSummary {
  id: number;
  title: string;
  venue: string | null;
  runningTime: string | null;
  imageUrl: string | null;
  /** Performances between `from` and `to` when a range was requested. */
  performanceCount: number;
}

export interface PerformanceItem {
  id: number;
  showId: number;
  localDate: string;
  localTime: string;
  slot: Slot;
  minPrice: number | null;
  bookingUrl: string | null;
}

export type ScrapeRun = Omit<typeof scrapeRuns.$inferSelect, "warnings"> & { warnings: string[] };
export type ScrapeShowResult = typeof scrapeShowResults.$inferSelect;

export interface ScrapeOverview {
  runs: ScrapeRun[];
  stats: {
    shows: number;
    performances: number;
    /** Finish time of the latest full run that completed (ok or partial). */
    lastSuccessAt: string | null;
  };
}

export interface ScrapeRunDetail {
  run: ScrapeRun;
  results: ScrapeShowResult[];
}
