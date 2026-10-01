import type { scrapeRuns } from "@/db/schema";
import type { ScrapeRun } from "./api-types";

export function toApiRun(run: typeof scrapeRuns.$inferSelect): ScrapeRun {
  return { ...run, warnings: run.warnings ? JSON.parse(run.warnings) : [] };
}
