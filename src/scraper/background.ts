import type { Db } from "@/db/client";
import { defaultScrapeOptions } from "./defaults";
import { beginRun, executeRun } from "./orchestrator";

/** Starts a full scrape inside the web server process and returns its run row immediately. */
export function startBackgroundScrape(db: Db) {
  const opts = { ...defaultScrapeOptions, trigger: "ui" as const };
  const run = beginRun(db, opts);
  executeRun(db, run, opts).catch((err) => console.error(`Scrape run #${run.id} crashed`, err));
  return run;
}
