import { createHash, timingSafeEqual } from "node:crypto";
import type { APIRoute } from "astro";
import { count, countDistinct, desc, gte } from "drizzle-orm";
import { db } from "@/db";
import { performances, scrapeRuns } from "@/db/schema";
import type { ScrapeOverview } from "@/lib/api-types";
import { json } from "@/lib/params";
import { lastSuccessfulFullScrape, toApiRun } from "@/lib/scrape-runs";
import { startBackgroundScrape } from "@/scraper/background";
import { ScrapeInProgressError } from "@/scraper/orchestrator";

/** GET /api/scrapes — recent runs and data freshness. */
export const GET: APIRoute = () => {
  const runs = db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.id)).limit(100).all();
  const totals = db
    .select({ shows: countDistinct(performances.showId), performances: count() })
    .from(performances)
    .where(gte(performances.startsAt, new Date().toISOString()))
    .get()!;

  const overview: ScrapeOverview = {
    runs: runs.map(toApiRun),
    stats: { ...totals, lastSuccessAt: lastSuccessfulFullScrape(db) },
  };
  return json(overview);
};

// Hash both sides so the comparison is constant-time whatever the lengths.
const digest = (value: string) => createHash("sha256").update(value).digest();

/** POST /api/scrapes — start a full scrape in the background. Requires the x-scrape-token header. */
export const POST: APIRoute = ({ request }) => {
  const expected = process.env.SCRAPE_TOKEN;
  if (!expected) return json({ error: "Starting scrapes from the UI is disabled (SCRAPE_TOKEN is not set)" }, 503);
  const given = request.headers.get("x-scrape-token") ?? "";
  if (!timingSafeEqual(digest(given), digest(expected))) return json({ error: "Wrong scrape token" }, 401);

  try {
    const run = startBackgroundScrape(db, "ui");
    return json({ id: run.id }, 202);
  } catch (err) {
    if (err instanceof ScrapeInProgressError) return json({ error: err.message, id: err.runId }, 409);
    throw err;
  }
};
