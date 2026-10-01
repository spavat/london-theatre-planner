import { describe, expect, it } from "vitest";
import type { PerformanceItem } from "@/lib/api-types";
import { pinKey, planOptions } from "@/lib/plan";

let nextId = 1;
const perf = (showId: number, localDate: string, localTime: string): PerformanceItem => ({
  id: nextId++,
  showId,
  localDate,
  localTime,
  slot: localTime < "17:00" ? "matinee" : "evening",
  minPrice: null,
  bookingUrl: null,
});

const lionSat = perf(1, "2026-10-10", "14:30");
const lionSatEve = perf(1, "2026-10-10", "19:30");
const lionSun = perf(1, "2026-10-11", "14:30");
const hamiltonSat = perf(2, "2026-10-10", "14:30");
const hamiltonSatEve = perf(2, "2026-10-10", "19:30");
const all = [lionSat, lionSatEve, lionSun, hamiltonSat, hamiltonSatEve];

describe("planOptions", () => {
  it("returns everything when nothing is pinned", () => {
    expect(planOptions(all, [])).toEqual(all);
  });

  it("drops the pinned show's other performances and other shows in the pinned slot", () => {
    expect(planOptions(all, [pinKey(lionSat)])).toEqual([lionSat, hamiltonSatEve]);
  });

  it("combines several pins", () => {
    expect(planOptions(all, [pinKey(lionSat), pinKey(hamiltonSatEve)])).toEqual([lionSat, hamiltonSatEve]);
  });

  it("ignores pins that match no performance", () => {
    expect(planOptions(all, ["99@2026-10-10T14:30"])).toEqual(all);
  });
});
