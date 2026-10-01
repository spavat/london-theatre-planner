import { and, desc, eq, gte, inArray, isNull, lt, ne, notInArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { performances, scrapeRuns, scrapeShowResults, showSources, shows } from "@/db/schema";
import { slotFor } from "@/lib/slots";
import { sleep } from "./http";
import { type ScrapedShow, type ShowRef, type Source, sameShow, showKey } from "./sources/types";

/** A run with no progress for this long is assumed dead (crashed or restarted process). */
const STALE_RUN_MS = 5 * 60 * 1000;
const KEEP_RUNS = 100;

export interface ScrapeOptions {
  primary: Source;
  fallback?: Source;
  storeImage: (slug: string, imageUrl: string) => Promise<string>;
  trigger?: "cli" | "ui" | "schedule";
  /** Only scrape shows whose title key contains this text. */
  filter?: string;
  limit?: number;
  delayMs?: number;
  log?: (message: string) => void;
}

export class ScrapeInProgressError extends Error {
  constructor(public runId: number) {
    super(`Scrape run #${runId} is already in progress`);
  }
}

type Run = typeof scrapeRuns.$inferSelect;
type ShowResult = typeof scrapeShowResults.$inferInsert;

export async function runScrape(db: Db, opts: ScrapeOptions) {
  return executeRun(db, beginRun(db, opts), opts);
}

/**
 * Creates the run row. Synchronous so callers (the API) get the run id before scraping starts.
 * Throws ScrapeInProgressError if another run is active.
 */
export function beginRun(db: Db, opts: ScrapeOptions): Run {
  return db.transaction((tx) => {
    const now = Date.now();
    for (const running of tx.select().from(scrapeRuns).where(eq(scrapeRuns.status, "running")).all()) {
      const lastSeen = Date.parse(running.heartbeatAt ?? running.startedAt);
      if (now - lastSeen < STALE_RUN_MS) throw new ScrapeInProgressError(running.id);
      tx.update(scrapeRuns)
        .set({ status: "interrupted", finishedAt: new Date(now).toISOString() })
        .where(eq(scrapeRuns.id, running.id))
        .run();
    }

    const scope = [
      opts.filter && `show=${opts.filter}`,
      opts.limit && `limit=${opts.limit}`,
      !opts.fallback && `${opts.primary.name} only`,
    ].filter(Boolean);
    return tx
      .insert(scrapeRuns)
      .values({
        source: opts.primary.name,
        trigger: opts.trigger ?? "cli",
        scope: scope.length ? scope.join(", ") : null,
        startedAt: new Date(now).toISOString(),
        heartbeatAt: new Date(now).toISOString(),
        status: "running",
      })
      .returning()
      .get();
  });
}

export async function executeRun(db: Db, run: Run, opts: ScrapeOptions) {
  const { primary, fallback, delayMs = 1000, log = console.log } = opts;
  const runErrors: string[] = [];
  const results: ShowResult[] = [];
  const counts = {
    showsOk: 0,
    showsFallback: 0,
    showsFailed: 0,
    performancesAdded: 0,
    performancesRemoved: 0,
    imagesStored: 0,
    imagesFailed: 0,
  };
  let listingFailed = false;
  let fatal = false;

  try {
    const listing = await listShows(primary, fallback);
    runErrors.push(...listing.errors);
    listingFailed = listing.errors.length > 0;
    let work = listing.work;
    if (opts.filter) work = work.filter((w) => showKey(w.ref.title).includes(showKey(opts.filter!)));
    if (opts.limit) work = work.slice(0, opts.limit);
    db.update(scrapeRuns)
      .set({ listSource: listing.listSource, showsListed: work.length, heartbeatAt: new Date().toISOString() })
      .where(eq(scrapeRuns.id, run.id))
      .run();
    log(`${work.length} shows listed from ${listing.listSource}`);

    for (const [i, item] of work.entries()) {
      if (i > 0) await sleep(delayMs);
      const result = await scrapeOne(db, item, opts, delayMs);
      results.push(result);
      db.insert(scrapeShowResults).values({ ...result, runId: run.id }).run();

      if (result.result === "failed") counts.showsFailed++;
      else counts.showsOk++;
      if (result.result === "fallback") counts.showsFallback++;
      counts.performancesAdded += result.performancesAdded ?? 0;
      counts.performancesRemoved += result.performancesRemoved ?? 0;
      if (result.imageStatus === "stored") counts.imagesStored++;
      if (result.imageStatus === "failed") counts.imagesFailed++;
      // Keep the run row current so the dashboard can show live progress.
      db.update(scrapeRuns)
        .set({ ...counts, heartbeatAt: new Date().toISOString() })
        .where(eq(scrapeRuns.id, run.id))
        .run();

      if (result.result === "failed") log(`✗ ${result.title}: ${result.error}`);
      else log(`✓ ${result.title} (${result.performances} performances, ${result.source})`);
      if (result.imageStatus === "failed") log(`  image failed: ${result.error}`);
    }
  } catch (err) {
    fatal = true;
    runErrors.push(message(err));
    log(`Run failed: ${message(err)}`);
  }

  const finished = db.select().from(scrapeRuns).where(eq(scrapeRuns.id, run.id)).get()!;
  const warnings = computeWarnings(db, finished, results);
  const hasProblems = listingFailed || counts.showsFailed > 0 || counts.imagesFailed > 0;
  const status = fatal || (counts.showsOk === 0 && finished.showsListed > 0) ? "failed" : hasProblems ? "partial" : "ok";

  db.update(scrapeRuns)
    .set({
      finishedAt: new Date().toISOString(),
      status,
      warnings: warnings.length ? JSON.stringify(warnings) : null,
      errorLog: runErrors.length ? runErrors.join("\n") : null,
    })
    .where(eq(scrapeRuns.id, run.id))
    .run();
  pruneRuns(db);
  for (const w of warnings) log(`⚠ ${w}`);

  return { runId: run.id, status, ...counts, warnings, errors: runErrors };
}

interface WorkItem {
  ref: ShowRef;
  source: Source;
  /** The same show on the fallback source, tried when `source` has no schedule for it. */
  alternative?: { source: Source; ref: ShowRef };
}

/**
 * Lists shows from both sources and merges them by title: shows the primary lists are scraped there
 * (with the fallback's page as a backup), shows only the fallback lists are scraped from the fallback.
 * Throws only if no listing worked at all.
 */
export async function listShows(primary: Source, fallback: Source | undefined) {
  const [fromPrimary, fromFallback] = await Promise.allSettled([
    primary.listShows(),
    fallback ? fallback.listShows() : Promise.resolve([]),
  ]);
  if (fromPrimary.status === "rejected" && (!fallback || fromFallback.status === "rejected")) throw fromPrimary.reason;

  const errors: string[] = [];
  if (fromPrimary.status === "rejected") errors.push(`Listing from ${primary.name} failed: ${message(fromPrimary.reason)}`);
  if (fallback && fromFallback.status === "rejected") {
    errors.push(`Listing from ${fallback.name} failed: ${message(fromFallback.reason)}`);
  }
  const primaryRefs = fromPrimary.status === "fulfilled" ? fromPrimary.value : [];
  const unmatched = fromFallback.status === "fulfilled" ? [...fromFallback.value] : [];

  const work: WorkItem[] = primaryRefs.map((ref) => {
    const index = unmatched.findIndex((other) => sameShow(ref.title, other.title));
    if (!fallback || index === -1) return { ref, source: primary };
    const [alternative] = unmatched.splice(index, 1);
    return { ref, source: primary, alternative: { source: fallback, ref: alternative } };
  });
  // Shows only the fallback lists and sells. The same title can be listed twice (several productions); keep one.
  const seen = new Set<string>();
  for (const ref of unmatched) {
    if (ref.onSale === false || seen.has(showKey(ref.title))) continue;
    seen.add(showKey(ref.title));
    work.push({ ref, source: fallback! });
  }

  const listSource = [
    fromPrimary.status === "fulfilled" && primary.name,
    fallback && fromFallback.status === "fulfilled" && fallback.name,
  ]
    .filter(Boolean)
    .join("+");
  return { work, listSource, errors };
}

async function scrapeOne(db: Db, item: WorkItem, opts: ScrapeOptions, delayMs: number): Promise<ShowResult> {
  const { ref } = item;
  const started = Date.now();
  const result: ShowResult = {
    runId: 0,
    title: ref.title,
    url: ref.url,
    result: "failed",
    durationMs: 0,
  };

  try {
    const fetched = await fetchWithFallback(item, delayMs);
    // Keyed by the listed title so a show keeps one identity whichever source served it.
    const saved = saveShow(db, fetched.source.name, fetched.show, { slug: showKey(ref.title) });
    Object.assign(result, {
      showId: saved.showId,
      title: fetched.show.title,
      result: fetched.outcome,
      source: fetched.source.name,
      fallbackReason: fetched.fallbackReason,
      performances: saved.performances,
      performancesAdded: saved.added,
      performancesRemoved: saved.removed,
      imageStatus: saved.needsImage ? "none" : "existing",
    } satisfies Partial<ShowResult>);

    if (saved.needsImage && fetched.show.imageUrl) {
      // An image failure doesn't invalidate the schedule; it is retried on the next run.
      try {
        const key = await opts.storeImage(saved.slug, fetched.show.imageUrl);
        db.update(shows).set({ imageKey: key }).where(eq(shows.id, saved.showId)).run();
        result.imageStatus = "stored";
      } catch (err) {
        result.imageStatus = "failed";
        result.error = `Image: ${message(err)}`;
      }
    }
  } catch (err) {
    result.error = message(err);
    result.showId = db.select({ id: shows.id }).from(shows).where(eq(shows.slug, showKey(ref.title))).get()?.id;
  }

  result.durationMs = Date.now() - started;
  return result;
}

type Attempt = { show: ScrapedShow; error?: never } | { show?: never; error: unknown };

async function attempt(source: Source, ref: ShowRef): Promise<Attempt> {
  try {
    return { show: await source.fetchShow(ref) };
  } catch (error) {
    return { error };
  }
}

const describeAttempt = (source: Source, a: Attempt) =>
  a.show ? `No performances on ${source.name}` : message(a.error);

/**
 * Tries the listed source, then the same show on the other source.
 * Returns "empty" only when both loaded fine with no performances; any real error throws,
 * so the show's existing performances are kept.
 */
async function fetchWithFallback({ ref, source, alternative }: WorkItem, delayMs: number) {
  const first = await attempt(source, ref);
  if (first.show && first.show.performances.length > 0) {
    return { source, show: first.show, outcome: "ok" as const, fallbackReason: null };
  }
  if (!alternative) throw new Error(describeAttempt(source, first));

  await sleep(delayMs);
  const second = await attempt(alternative.source, alternative.ref);
  if (second.show && second.show.performances.length > 0) {
    return {
      source: alternative.source,
      show: second.show,
      outcome: "fallback" as const,
      fallbackReason: describeAttempt(source, first),
    };
  }
  if (first.show && second.show) return { source, show: first.show, outcome: "empty" as const, fallbackReason: null };
  throw new Error(`${describeAttempt(source, first)}; ${describeAttempt(alternative.source, second)}`);
}

/** Upserts the show and replaces its future performances. Runs in one transaction. */
export function saveShow(
  db: Db,
  sourceName: Source["name"],
  scraped: ScrapedShow,
  { slug = showKey(scraped.title), now = new Date() }: { slug?: string; now?: Date } = {},
) {
  const nowIso = now.toISOString();
  const scrapedAt = nowIso;

  return db.transaction((tx) => {
    const metadata = { title: scraped.title, venue: scraped.venue, runningTime: scraped.runningTime };
    tx.insert(shows)
      .values({ slug, ...metadata })
      .onConflictDoUpdate({ target: shows.slug, set: { ...metadata, updatedAt: nowIso } })
      .run();
    const show = tx.select().from(shows).where(eq(shows.slug, slug)).get()!;

    tx.insert(showSources)
      .values({ showId: show.id, source: sourceName, externalId: scraped.externalId, url: scraped.url })
      .onConflictDoUpdate({
        target: [showSources.source, showSources.externalId],
        set: { showId: show.id, url: scraped.url },
      })
      .run();

    const futureOfShow = and(eq(performances.showId, show.id), gte(performances.startsAt, nowIso));
    const before = new Set(
      tx.select({ startsAt: performances.startsAt }).from(performances).where(futureOfShow).all().map((p) => p.startsAt),
    );
    tx.delete(performances).where(futureOfShow).run();

    const rows = scraped.performances
      .map((p) => ({
        showId: show.id,
        startsAt: new Date(p.startsAt).toISOString(),
        localDate: p.localDate,
        localTime: p.localTime,
        slot: slotFor(p.localTime),
        minPrice: p.minPrice,
        bookingUrl: p.bookingUrl,
        source: sourceName,
        scrapedAt,
      }))
      .filter((p) => p.startsAt >= nowIso);
    if (rows.length) tx.insert(performances).values(rows).onConflictDoNothing().run();

    const after = new Set(rows.map((r) => r.startsAt));
    return {
      showId: show.id,
      slug,
      needsImage: show.imageKey === null,
      performances: after.size,
      added: [...after].filter((s) => !before.has(s)).length,
      removed: [...before].filter((s) => !after.has(s)).length,
    };
  });
}

/** Signals worth a human look: likely parser breakage or shows silently losing their schedule. */
export function computeWarnings(db: Db, run: Run, results: ShowResult[]): string[] {
  const warnings: string[] = [];

  if (run.scope === null) {
    if (run.showsListed === 0) warnings.push("No shows were listed. The listing page parser may be broken.");

    const previous = db
      .select()
      .from(scrapeRuns)
      .where(
        and(
          isNull(scrapeRuns.scope),
          inArray(scrapeRuns.status, ["ok", "partial"]),
          lt(scrapeRuns.id, run.id),
        ),
      )
      .orderBy(desc(scrapeRuns.id))
      .get();
    if (previous) {
      if (run.showsListed < previous.showsListed * 0.8) {
        warnings.push(`Only ${run.showsListed} shows listed, the previous run listed ${previous.showsListed}.`);
      }
      const listedNow = new Set(results.map((r) => showKey(r.title)));
      const gone = db
        .select({ title: scrapeShowResults.title })
        .from(scrapeShowResults)
        .where(and(eq(scrapeShowResults.runId, previous.id), ne(scrapeShowResults.result, "failed")))
        .all()
        .filter((r) => !listedNow.has(showKey(r.title)))
        .map((r) => r.title);
      if (gone.length) warnings.push(`No longer listed: ${listSample(gone)}.`);
    }
  }

  if (run.showsListed >= 5 && run.showsFallback / run.showsListed > 0.2) {
    warnings.push(
      `${run.showsFallback} of ${run.showsListed} shows needed the fallback source. The primary parser may be broken.`,
    );
  }

  for (const r of results) {
    const removed = r.performancesRemoved ?? 0;
    const previousCount = (r.performances ?? 0) - (r.performancesAdded ?? 0) + removed;
    if (previousCount >= 10 && removed > previousCount / 2) {
      warnings.push(`${r.title} lost ${removed} of ${previousCount} performances.`);
    }
  }

  return warnings;
}

function pruneRuns(db: Db) {
  const keep = db.select({ id: scrapeRuns.id }).from(scrapeRuns).orderBy(desc(scrapeRuns.id)).limit(KEEP_RUNS);
  db.delete(scrapeRuns).where(notInArray(scrapeRuns.id, keep)).run();
}

function listSample(titles: string[], max = 10) {
  const shown = titles.slice(0, max).join(", ");
  return titles.length > max ? `${shown} and ${titles.length - max} more` : shown;
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
