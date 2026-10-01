import { describe, expect, it } from "vitest";
import { EMPTY_PLAN, isEmptyPlan, parsePlanParams, planToParams, samePlan } from "@/lib/plan-state";

const plan = {
  range: { from: "2026-10-16", to: "2026-10-18" },
  selected: [1, 49],
  planning: true,
  pins: ["1@2026-10-17T14:30"],
};

describe("plan state", () => {
  it("round-trips through share link params", () => {
    expect(parsePlanParams(`?${planToParams(plan)}`)).toEqual(plan);
  });

  it("reads links made before pins existed", () => {
    expect(parsePlanParams("?from=2026-10-16&to=2026-10-18&shows=1,49")).toEqual({ ...plan, planning: false, pins: [] });
  });

  it("treats a URL without plan params as no shared plan", () => {
    expect(parsePlanParams("")).toBeNull();
    expect(parsePlanParams("?utm_source=x")).toBeNull();
  });

  it("compares plans", () => {
    expect(isEmptyPlan(EMPTY_PLAN)).toBe(true);
    expect(samePlan(plan, { ...plan, selected: [1, 49] })).toBe(true);
    expect(samePlan(plan, { ...plan, pins: [] })).toBe(false);
  });
});
