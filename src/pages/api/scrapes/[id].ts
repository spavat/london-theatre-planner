import type { APIRoute } from "astro";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scrapeRuns, scrapeShowResults } from "@/db/schema";
import type { ScrapeRunDetail } from "@/lib/api-types";
import { json } from "@/lib/params";
import { toApiRun } from "@/lib/scrape-runs";

/** GET /api/scrapes/:id — one run with its per-show results. */
export const GET: APIRoute = ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid run id" }, 400);
  const run = db.select().from(scrapeRuns).where(eq(scrapeRuns.id, id)).get();
  if (!run) return json({ error: "Run not found" }, 404);

  const results = db
    .select()
    .from(scrapeShowResults)
    .where(eq(scrapeShowResults.runId, id))
    .orderBy(asc(scrapeShowResults.id))
    .all();
  const detail: ScrapeRunDetail = { run: toApiRun(run), results };
  return json(detail);
};
