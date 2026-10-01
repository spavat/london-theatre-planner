import { and, desc, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { scrapeRuns } from "@/db/schema";
import type { ScrapeRun } from "./api-types";

export function toApiRun(run: typeof scrapeRuns.$inferSelect): ScrapeRun {
  return { ...run, warnings: run.warnings ? JSON.parse(run.warnings) : [] };
}

/** Finish time of the latest full run that completed (ok or partial), or null. */
export function lastSuccessfulFullScrape(db: Db): string | null {
  const run = db
    .select({ finishedAt: scrapeRuns.finishedAt })
    .from(scrapeRuns)
    .where(and(isNull(scrapeRuns.scope), inArray(scrapeRuns.status, ["ok", "partial"])))
    .orderBy(desc(scrapeRuns.id))
    .get();
  return run?.finishedAt ?? null;
}
