import { CheckIcon, LinkIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PerformanceItem, ShowSummary } from "@/lib/api-types";
import { pinKey, planOptions } from "@/lib/plan";
import {
  EMPTY_PLAN,
  isEmptyPlan,
  loadSavedPlan,
  type PlanState,
  parsePlanParams,
  planToParams,
  samePlan,
  savePlan,
} from "@/lib/plan-state";
import { DateRangePicker } from "./DateRangePicker";
import { ShowPicker } from "./ShowPicker";
import { TripCalendar } from "./TripCalendar";

/**
 * The saved plan, or the one from a shared link. A shared link replaces a different saved plan only
 * after confirmation; the URL is then cleaned so localStorage stays the single source of truth.
 * Computed once per page load (React may call state initialisers twice).
 */
let initialPlan: PlanState | undefined;
function getInitialPlan(): PlanState {
  if (initialPlan) return initialPlan;
  const saved = loadSavedPlan();
  const shared = parsePlanParams(window.location.search);
  initialPlan = saved ?? EMPTY_PLAN;
  if (shared) {
    window.history.replaceState(null, "", window.location.pathname);
    const replace =
      !saved ||
      isEmptyPlan(saved) ||
      samePlan(saved, shared) ||
      window.confirm("Open the shared plan? It will replace the plan you're working on.");
    if (replace) initialPlan = shared;
  }
  return initialPlan;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

export function Planner() {
  const [initial] = useState(getInitialPlan);
  const [range, setRange] = useState(initial.range);
  const [selected, setSelected] = useState(initial.selected);
  const [planning, setPlanning] = useState(initial.planning);
  const [pins, setPins] = useState(initial.pins);
  const [shows, setShows] = useState<ShowSummary[] | null>(null);
  const [performances, setPerformances] = useState<PerformanceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => savePlan({ range, selected, planning, pins }), [range, selected, planning, pins]);

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?${planToParams({ range, selected, planning, pins })}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context and permission; fall back to letting the user copy it.
      window.prompt("Copy this link to share your plan:", url);
    }
  };

  useEffect(() => {
    if (!range) return;
    getJson<ShowSummary[]>(`/api/shows?from=${range.from}&to=${range.to}`)
      .then(setShows)
      .catch((err) => setError(err.message));
  }, [range]);

  useEffect(() => {
    if (!range || selected.length === 0) return setPerformances([]);
    getJson<PerformanceItem[]>(`/api/performances?from=${range.from}&to=${range.to}&shows=${selected.join(",")}`)
      .then(setPerformances)
      .catch((err) => setError(err.message));
  }, [range, selected]);

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  // Keep selection order so colours stay stable as shows are added.
  const selectedShows = selected.map((id) => shows?.find((s) => s.id === id)).filter((s) => s !== undefined);
  // A selected show can drop out of the list when the dates change; keep it visible as "not playing".
  const missing = shows ? selected.filter((id) => !shows.some((s) => s.id === id)) : [];
  const togglePin = (p: PerformanceItem) => {
    const key = pinKey(p);
    setPins((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="space-y-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <DateRangePicker value={range} onChange={setRange} />
          </div>
          <Button variant="outline" onClick={share} disabled={!range} title="Copy a link to this plan">
            {copied ? <CheckIcon /> : <LinkIcon />}
            {copied ? "Copied" : "Share"}
          </Button>
        </div>
        {range && (
          <>
            {selectedShows.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedShows.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1">
                    {s.title}
                    <button type="button" onClick={() => toggle(s.id)} aria-label={`Remove ${s.title}`}>
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <ShowPicker shows={shows ?? []} selected={selected} onToggle={toggle} />
          </>
        )}
      </aside>

      <main className="min-w-0">
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
        {!range ? (
          <p className="text-muted-foreground">Pick your travel dates to see what's on.</p>
        ) : selected.length === 0 ? (
          <p className="text-muted-foreground">Select the shows you'd like to see.</p>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">All options</h2>
              <TripCalendar range={range} shows={selectedShows} performances={performances} />
              {missing.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {missing.length} selected show(s) have no performances during these dates.{" "}
                  <button type="button" className="underline" onClick={() => setSelected(selected.filter((id) => !missing.includes(id)))}>
                    Remove them
                  </button>
                </p>
              )}
            </section>

            <section className="space-y-3 border-t pt-6">
              <h2 className="text-lg font-semibold">My plan</h2>
              {planning ? (
                <TripCalendar
                  range={range}
                  shows={selectedShows}
                  performances={planOptions(performances, pins)}
                  pinning={{ isPinned: (p) => pins.includes(pinKey(p)), onToggle: togglePin }}
                />
              ) : (
                <Button onClick={() => setPlanning(true)}>Start planning</Button>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
