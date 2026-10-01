import type { APIRoute } from "astro";
import { and, asc, count, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { performances, shows } from "@/db/schema";
import type { ShowSummary } from "@/lib/api-types";
import { BadRequest, dateParam, json } from "@/lib/params";

/** GET /api/shows?from=YYYY-MM-DD&to=YYYY-MM-DD — shows with at least one performance in the range. */
export const GET: APIRoute = ({ url }) => {
  let from: string | undefined, to: string | undefined;
  try {
    from = dateParam(url, "from");
    to = dateParam(url, "to");
  } catch (err) {
    if (err instanceof BadRequest) return json({ error: err.message }, 400);
    throw err;
  }

  const rows = db
    .select({
      id: shows.id,
      title: shows.title,
      venue: shows.venue,
      runningTime: shows.runningTime,
      imageKey: shows.imageKey,
      performanceCount: count(performances.id),
    })
    .from(shows)
    .innerJoin(
      performances,
      and(
        eq(performances.showId, shows.id),
        from ? gte(performances.localDate, from) : undefined,
        to ? lte(performances.localDate, to) : undefined,
      ),
    )
    .groupBy(shows.id)
    .orderBy(asc(shows.title))
    .all();

  const result: ShowSummary[] = rows.map(({ imageKey, ...show }) => ({
    ...show,
    imageUrl: imageKey ? `/img/${imageKey}` : null,
  }));
  return json(result);
};
