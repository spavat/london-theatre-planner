import { Cron } from "croner";
import type { Db } from "@/db/client";
import { lastSuccessfulFullScrape } from "@/lib/scrape-runs";
import { startBackgroundScrape } from "./background";
import { ScrapeInProgressError } from "./orchestrator";

/** Mondays at 05:00, London time. */
const DEFAULT_CRON = "0 5 * * 1";
const CATCH_UP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const CATCH_UP_DELAY_MS = 60_000;

/** True when the last successful full scrape is missing or older than a week (e.g. the server was down at the scheduled time). */
export function needsCatchUp(lastSuccessAt: string | null, now = Date.now()): boolean {
  return lastSuccessAt === null || now - Date.parse(lastSuccessAt) > CATCH_UP_AFTER_MS;
}

/**
 * Runs a full scrape on SCRAPE_CRON (default weekly), plus a catch-up shortly after startup when data is stale.
 * Set SCRAPE_CRON to an empty string to disable.
 */
export function startScheduler(db: Db, cron = process.env.SCRAPE_CRON ?? DEFAULT_CRON) {
  if (cron.trim() === "") {
    console.log("Scheduled scrapes disabled (SCRAPE_CRON is empty)");
    return;
  }

  const run = (reason: string) => {
    try {
      const started = startBackgroundScrape(db, "schedule");
      console.log(`Scrape run #${started.id} started (${reason})`);
    } catch (err) {
      if (err instanceof ScrapeInProgressError) console.log(`Skipped ${reason} scrape: ${err.message}`);
      else console.error(`Could not start ${reason} scrape`, err);
    }
  };

  const job = new Cron(cron, { timezone: "Europe/London" }, () => run("scheduled"));
  console.log(`Scheduled scrapes: "${cron}" (Europe/London), next at ${job.nextRun()?.toISOString()}`);

  if (needsCatchUp(lastSuccessfulFullScrape(db))) {
    console.log("No full scrape in the last week, starting one shortly");
    setTimeout(() => run("catch-up"), CATCH_UP_DELAY_MS).unref();
  }
}
