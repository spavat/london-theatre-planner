import type { APIRoute } from "astro";
import { and, asc, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { performances } from "@/db/schema";
import type { PerformanceItem } from "@/lib/api-types";
import { BadRequest, dateParam, json } from "@/lib/params";

/** GET /api/performances?from=YYYY-MM-DD&to=YYYY-MM-DD&shows=1,2,3 */
export const GET: APIRoute = ({ url }) => {
  let from: string | undefined, to: string | undefined;
  try {
    from = dateParam(url, "from");
    to = dateParam(url, "to");
  } catch (err) {
    if (err instanceof BadRequest) return json({ error: err.message }, 400);
    throw err;
  }
  if (!from || !to) return json({ error: "from and to are required" }, 400);

  const showIds = (url.searchParams.get("shows") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number);
  if (showIds.some((id) => !Number.isInteger(id))) return json({ error: "shows must be a list of ids" }, 400);
  if (showIds.length === 0) return json([]);

  const result: PerformanceItem[] = db
    .select({
      id: performances.id,
      showId: performances.showId,
      localDate: performances.localDate,
      localTime: performances.localTime,
      slot: performances.slot,
      minPrice: performances.minPrice,
      bookingUrl: performances.bookingUrl,
    })
    .from(performances)
    .where(
      and(
        inArray(performances.showId, showIds),
        gte(performances.localDate, from),
        lte(performances.localDate, to),
      ),
    )
    .orderBy(asc(performances.localDate), asc(performances.localTime))
    .all();
  return json(result);
};
