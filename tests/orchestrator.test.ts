import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { type Db, openDb } from "@/db/client";
import { performances, scrapeRuns, scrapeShowResults, shows } from "@/db/schema";
import { beginRun, runScrape, ScrapeInProgressError, saveShow } from "@/scraper/orchestrator";
import type { ScrapedShow, Source } from "@/scraper/sources/types";

const perf = (iso: string) => ({
  startsAt: iso,
  localDate: iso.slice(0, 10),
  localTime: iso.slice(11, 16),
  minPrice: 30,
  bookingUrl: "https://book.example",
});

const scraped = (title: string, isos: string[]): ScrapedShow => ({
  externalId: title,
  url: `https://example/${title}`,
  title,
  venue: "Some Theatre",
  runningTime: null,
  imageUrl: "https://example/img.jpg",
  performances: isos.map(perf),
});

let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
});

const noImage = async () => "shows/x.jpg";

describe("saveShow", () => {
  it("replaces future performances but keeps past ones", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const firstScrape = ["2026-10-09T19:30:00+01:00", "2026-10-11T19:30:00+01:00", "2026-10-12T14:30:00+01:00"];
    saveShow(db, "olt", scraped("Hamlet", firstScrape), { now: new Date("2026-10-01T00:00:00Z") });
    // Rescrape after the 9th has passed: the 11th was cancelled.
    saveShow(db, "olt", scraped("Hamlet", ["2026-10-12T14:30:00+01:00"]), { now });

    const rows = db.select().from(performances).all().map((p) => [p.localDate, p.slot]);
    expect(rows.sort()).toEqual([
      ["2026-10-09", "evening"],
      ["2026-10-12", "matinee"],
    ]);
  });

  it("stores start times in UTC whatever the source format", () => {
    saveShow(db, "ltc", scraped("Hamlet", ["2099-01-01T19:30:00.000+00:00"]));
    expect(db.select().from(performances).get()!.startsAt).toBe("2099-01-01T19:30:00.000Z");
  });
});

describe("runScrape", () => {
  const future = ["2099-06-01T19:30:00+01:00"];
  const quiet = { storeImage: noImage, delayMs: 0, log: () => {} };

  const sourceOf = (titles: string[], fetchShow: Source["fetchShow"]): Source => ({
    name: "olt",
    listShows: async () => titles.map((title, i) => ({ externalId: String(i), url: `u${i}`, title })),
    fetchShow,
  });

  it("uses the fallback source when the primary fails for a show and logs why", async () => {
    const primary = sourceOf(["Disney’s The Lion King", "Hamlet"], async (ref) => {
      if (ref.title === "Disney’s The Lion King") throw new Error("boom");
      return scraped("Hamlet", future);
    });
    const fallback: Source = {
      name: "ltc",
      listShows: async () => [{ externalId: "302", url: "ltc/302", title: "The Lion King" }],
      fetchShow: async () => scraped("The Lion King", future),
    };

    const result = await runScrape(db, { primary, fallback, ...quiet });

    expect(result).toMatchObject({ status: "ok", showsOk: 2, showsFallback: 1, imagesStored: 2, warnings: [] });
    const lionKing = db.select().from(shows).all().find((s) => s.slug === "lion-king")!;
    expect(lionKing.imageKey).toBe("shows/x.jpg");
    const rows = db.select().from(scrapeShowResults).all();
    expect(rows.find((r) => r.title === "The Lion King")).toMatchObject({
      result: "fallback",
      source: "ltc",
      fallbackReason: "boom",
      performances: 1,
      performancesAdded: 1,
      imageStatus: "stored",
    });
    expect(rows.find((r) => r.title === "Hamlet")).toMatchObject({ result: "ok", source: "olt" });
  });

  it("adds shows only the fallback lists, without scraping shared ones twice", async () => {
    const primary = sourceOf(["Disney’s The Lion King"], async () => scraped("Disney’s The Lion King", future));
    const fetchedFromFallback: string[] = [];
    const fallback: Source = {
      name: "ltc",
      listShows: async () => [
        { externalId: "302", url: "ltc/302", title: "The Lion King" },
        { externalId: "47411", url: "ltc/47411", title: "Feeling Afraid" },
        { externalId: "47412", url: "ltc/47412", title: "Feeling Afraid" },
      ],
      fetchShow: async (ref) => {
        fetchedFromFallback.push(ref.title);
        return scraped(ref.title, future);
      },
    };

    const result = await runScrape(db, { primary, fallback, ...quiet });

    expect(result).toMatchObject({ status: "ok", showsOk: 2, showsFallback: 0 });
    expect(fetchedFromFallback).toEqual(["Feeling Afraid"]);
    expect(db.select().from(scrapeRuns).get()!.listSource).toBe("olt+ltc");
    expect(db.select().from(scrapeShowResults).all().map((r) => [r.title, r.result, r.source])).toEqual([
      ["Disney’s The Lion King", "ok", "olt"],
      ["Feeling Afraid", "ok", "ltc"],
    ]);
  });

  it("carries on with the other source when one listing fails", async () => {
    const primary = sourceOf(["Hamlet"], async () => scraped("Hamlet", future));
    const fallback: Source = {
      name: "ltc",
      listShows: async () => {
        throw new Error("API down");
      },
      fetchShow: async () => scraped("x", future),
    };

    const result = await runScrape(db, { primary, fallback, ...quiet });

    expect(result).toMatchObject({ status: "partial", showsOk: 1, errors: ["Listing from ltc failed: API down"] });
    expect(db.select().from(scrapeRuns).get()!.listSource).toBe("olt");
  });

  it("records per-show failures without aborting the run", async () => {
    const primary = sourceOf(["Broken", "Hamlet"], async (ref) => {
      if (ref.title === "Broken") throw new Error("boom");
      return scraped("Hamlet", future);
    });

    const result = await runScrape(db, { primary, ...quiet });

    expect(result.status).toBe("partial");
    expect(db.select().from(scrapeRuns).get()).toMatchObject({
      status: "partial",
      scope: "olt only",
      showsListed: 2,
      showsOk: 1,
      showsFailed: 1,
    });
    expect(db.select().from(scrapeShowResults).all().find((r) => r.title === "Broken")).toMatchObject({
      result: "failed",
      error: "boom",
    });
  });

  it("warns when a show loses most of its performances between runs", async () => {
    const many = Array.from({ length: 20 }, (_, i) => `2099-06-${String(i + 1).padStart(2, "0")}T19:30:00+01:00`);
    let isos = many;
    const primary = sourceOf(["Hamlet"], async () => scraped("Hamlet", isos));
    await runScrape(db, { primary, ...quiet });

    isos = many.slice(0, 5);
    const result = await runScrape(db, { primary, ...quiet });

    expect(result.performancesRemoved).toBe(15);
    expect(result.warnings).toEqual(["Hamlet lost 15 of 20 performances."]);
  });

  it("refuses to start while another run is active, but clears stale ones", () => {
    const primary = sourceOf([], async () => scraped("x", []));
    const active = beginRun(db, { primary, ...quiet });
    expect(() => beginRun(db, { primary, ...quiet })).toThrow(ScrapeInProgressError);

    db.update(scrapeRuns).set({ heartbeatAt: new Date(Date.now() - 6 * 60_000).toISOString() }).run();
    beginRun(db, { primary, ...quiet });
    expect(db.select().from(scrapeRuns).all().find((r) => r.id === active.id)!.status).toBe("interrupted");
  });
});

describe("runScrape show identity", () => {
  it("saves a fallback scrape under the listed show, even when the fallback's title differs", async () => {
    const primary: Source = {
      name: "olt",
      listShows: async () => [{ externalId: "1", url: "u1", title: "Room On The Broom" }],
      fetchShow: async () => {
        throw new Error("no calendar");
      },
    };
    const fallback: Source = {
      name: "ltc",
      listShows: async () => [{ externalId: "2", url: "u2", title: "Room on the Broom Live On Stage" }],
      fetchShow: async () => scraped("Room on the Broom Live On Stage", ["2099-06-01T14:30:00+01:00"]),
    };

    await runScrape(db, { primary, fallback, storeImage: noImage, delayMs: 0, log: () => {} });

    expect(db.select({ slug: shows.slug }).from(shows).all()).toEqual([{ slug: "room-on-broom" }]);
  });
});

describe("runScrape when a show has no schedule", () => {
  const quiet = { storeImage: noImage, delayMs: 0, log: () => {} };
  const future = ["2099-06-01T19:30:00+01:00", "2099-06-02T19:30:00+01:00"];
  const listing = (name: Source["name"], onSale = true): Source["listShows"] => async () => [
    { externalId: name, url: name, title: "Hamlet", onSale },
  ];
  const throws = (msg: string) => async (): Promise<ScrapedShow> => {
    throw new Error(msg);
  };
  const returns = (isos: string[]) => async () => scraped("Hamlet", isos);

  /** Scrapes Hamlet once with performances, then again with the given sources. */
  async function rescrape(primaryFetch: Source["fetchShow"], fallbackFetch: Source["fetchShow"], onSale = true) {
    await runScrape(db, { primary: { name: "olt", listShows: listing("olt"), fetchShow: returns(future) }, ...quiet });
    return runScrape(db, {
      primary: { name: "olt", listShows: listing("olt"), fetchShow: primaryFetch },
      fallback: { name: "ltc", listShows: listing("ltc", onSale), fetchShow: fallbackFetch },
      ...quiet,
    });
  }
  const remaining = () => db.select().from(performances).all().length;

  it("clears future performances when both sites list none", async () => {
    // LTC flags it as not on sale: still used to confirm, never scraped on its own.
    const result = await rescrape(returns([]), returns([]), false);

    expect(result).toMatchObject({ status: "ok", showsOk: 1, showsFailed: 0, performancesRemoved: 2 });
    expect(result.warnings).toEqual([]); // fewer than 10 performances before: below the warning threshold
    expect(db.select().from(scrapeShowResults).all().at(-1)).toMatchObject({ result: "empty", performances: 0 });
    expect(remaining()).toBe(0);
  });

  it("keeps performances when the primary is empty but the fallback errors", async () => {
    const result = await rescrape(returns([]), throws("HTTP 503"));

    expect(result.showsFailed).toBe(1);
    expect(db.select().from(scrapeShowResults).all().at(-1)!.error).toBe("No performances on olt; HTTP 503");
    expect(remaining()).toBe(2);
  });

  it("keeps performances when the primary errors but the fallback is empty", async () => {
    const result = await rescrape(throws("Unrecognised show page u"), returns([]));

    expect(result.showsFailed).toBe(1);
    expect(remaining()).toBe(2);
  });

  it("keeps performances when only one site knows the show", async () => {
    await runScrape(db, { primary: { name: "olt", listShows: listing("olt"), fetchShow: returns(future) }, ...quiet });
    const result = await runScrape(db, {
      primary: { name: "olt", listShows: listing("olt"), fetchShow: returns([]) },
      fallback: { name: "ltc", listShows: async () => [], fetchShow: returns([]) },
      ...quiet,
    });

    expect(result.showsFailed).toBe(1);
    expect(remaining()).toBe(2);
  });
});
