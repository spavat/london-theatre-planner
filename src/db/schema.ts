import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export type SourceName = "olt" | "ltc";
export type Slot = "matinee" | "evening";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const shows = sqliteTable("shows", {
  id: integer().primaryKey({ autoIncrement: true }),
  slug: text().notNull().unique(),
  title: text().notNull(),
  venue: text(),
  runningTime: text("running_time"),
  imageKey: text("image_key"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const showSources = sqliteTable(
  "show_sources",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    showId: integer("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    source: text().$type<SourceName>().notNull(),
    externalId: text("external_id").notNull(),
    url: text().notNull(),
  },
  (t) => [uniqueIndex("show_sources_source_external").on(t.source, t.externalId)],
);

export const performances = sqliteTable(
  "performances",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    showId: integer("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    startsAt: text("starts_at").notNull(),
    localDate: text("local_date").notNull(),
    localTime: text("local_time").notNull(),
    slot: text().$type<Slot>().notNull(),
    minPrice: real("min_price"),
    bookingUrl: text("booking_url"),
    source: text().$type<SourceName>().notNull(),
    scrapedAt: text("scraped_at").notNull(),
  },
  (t) => [
    uniqueIndex("performances_show_starts").on(t.showId, t.startsAt),
    index("performances_local_date").on(t.localDate),
  ],
);

export type RunStatus = "running" | "ok" | "partial" | "failed" | "interrupted";

export const scrapeRuns = sqliteTable("scrape_runs", {
  id: integer().primaryKey({ autoIncrement: true }),
  source: text().notNull(),
  trigger: text().$type<"cli" | "ui">().notNull().default("cli"),
  /** null for a full run; otherwise what restricted it (e.g. "show=lion king, limit=5"). */
  scope: text(),
  /** Source the show list came from (differs from `source` when listing fell back). */
  listSource: text("list_source"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  /** Touched as the run progresses; a running run with an old heartbeat is dead. */
  heartbeatAt: text("heartbeat_at"),
  status: text().$type<RunStatus>().notNull(),
  showsListed: integer("shows_listed").notNull().default(0),
  showsOk: integer("shows_ok").notNull().default(0),
  showsFallback: integer("shows_fallback").notNull().default(0),
  showsFailed: integer("shows_failed").notNull().default(0),
  performancesAdded: integer("performances_added").notNull().default(0),
  performancesRemoved: integer("performances_removed").notNull().default(0),
  imagesStored: integer("images_stored").notNull().default(0),
  imagesFailed: integer("images_failed").notNull().default(0),
  /** JSON array of human-readable warnings computed at the end of the run. */
  warnings: text(),
  /** Run-level errors (listing failures, crashes). Per-show errors live in scrape_show_results. */
  errorLog: text("error_log"),
});

export const scrapeShowResults = sqliteTable(
  "scrape_show_results",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => scrapeRuns.id, { onDelete: "cascade" }),
    showId: integer("show_id").references(() => shows.id, { onDelete: "set null" }),
    title: text().notNull(),
    url: text().notNull(),
    /** "empty": every source that knows the show loaded fine and lists no performances. */
    result: text().$type<"ok" | "fallback" | "empty" | "failed">().notNull(),
    /** Source the data actually came from. */
    source: text().$type<SourceName>(),
    /** Why the primary source wasn't used, when result is "fallback". */
    fallbackReason: text("fallback_reason"),
    performances: integer().notNull().default(0),
    performancesAdded: integer("performances_added").notNull().default(0),
    performancesRemoved: integer("performances_removed").notNull().default(0),
    imageStatus: text("image_status").$type<"stored" | "existing" | "none" | "failed">().notNull().default("none"),
    error: text(),
    durationMs: integer("duration_ms").notNull(),
  },
  (t) => [index("scrape_show_results_run").on(t.runId)],
);
