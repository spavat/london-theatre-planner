export interface PlanState {
  range: { from: string; to: string } | null;
  selected: number[];
  planning: boolean;
  pins: string[];
}

export const EMPTY_PLAN: PlanState = { range: null, selected: [], planning: false, pins: [] };

const STORAGE_KEY = "planner:v1";

/** Plan carried by a shared link, or null when the URL has no plan in it. */
export function parsePlanParams(search: string): PlanState | null {
  const params = new URLSearchParams(search);
  const from = params.get("from");
  const to = params.get("to");
  const selected = (params.get("shows") ?? "").split(",").filter(Boolean).map(Number).filter(Number.isInteger);
  const pins = (params.get("pins") ?? "").split(",").filter(Boolean);
  if (!from && !to && selected.length === 0 && pins.length === 0) return null;
  return { range: from && to ? { from, to } : null, selected, planning: params.has("plan") || pins.length > 0, pins };
}

export function planToParams({ range, selected, planning, pins }: PlanState): string {
  const params = new URLSearchParams();
  if (range) {
    params.set("from", range.from);
    params.set("to", range.to);
  }
  if (selected.length) params.set("shows", selected.join(","));
  if (planning) params.set("plan", "1");
  if (pins.length) params.set("pins", pins.join(","));
  return params.toString();
}

export function isEmptyPlan(plan: PlanState): boolean {
  return planToParams(plan) === "";
}

export function samePlan(a: PlanState, b: PlanState): boolean {
  return planToParams(a) === planToParams(b);
}

// Storage can be unavailable (private mode, blocked site data); the planner still works, it just won't remember.
export function loadSavedPlan(): PlanState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY_PLAN, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function savePlan(plan: PlanState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {}
}
