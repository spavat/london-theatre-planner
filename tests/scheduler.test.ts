import { describe, expect, it } from "vitest";
import { needsCatchUp } from "@/scraper/scheduler";

describe("needsCatchUp", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  it("catches up when there has never been a full scrape", () => {
    expect(needsCatchUp(null, now)).toBe(true);
  });
  it("catches up when the last full scrape is more than a week old", () => {
    expect(needsCatchUp("2026-10-12T05:00:00Z", now)).toBe(true);
  });
  it("waits for the schedule when data is recent", () => {
    expect(needsCatchUp("2026-10-19T05:00:00Z", now)).toBe(false);
  });
});
