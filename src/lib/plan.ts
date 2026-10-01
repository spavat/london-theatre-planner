import type { PerformanceItem } from "./api-types";

/** Stable across rescrapes (performance ids are not): "<showId>@<date>T<time>". */
export function pinKey(p: Pick<PerformanceItem, "showId" | "localDate" | "localTime">): string {
  return `${p.showId}@${p.localDate}T${p.localTime}`;
}

/**
 * Options left once some performances are pinned: a pinned show is seen only once,
 * and a pinned day/slot holds only that show.
 */
export function planOptions(performances: PerformanceItem[], pins: string[]): PerformanceItem[] {
  const pinned = performances.filter((p) => pins.includes(pinKey(p)));
  const pinnedShows = new Set(pinned.map((p) => p.showId));
  const pinnedSlots = new Set(pinned.map((p) => `${p.localDate}/${p.slot}`));
  return performances.filter(
    (p) => pins.includes(pinKey(p)) || (!pinnedShows.has(p.showId) && !pinnedSlots.has(`${p.localDate}/${p.slot}`)),
  );
}
