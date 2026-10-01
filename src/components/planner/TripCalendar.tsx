import { eachDayOfInterval, format, parseISO } from "date-fns";
import { ExternalLinkIcon, PinIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Slot } from "@/db/schema";
import type { PerformanceItem, ShowSummary } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import type { TripRange } from "./DateRangePicker";

// Distinct hues so each selected show is easy to follow across days.
const SHOW_COLORS = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04", "#dc2626"];

interface Props {
  range: TripRange;
  shows: ShowSummary[];
  performances: PerformanceItem[];
  /** When set, each performance gets a pin (or unpin) button. */
  pinning?: {
    isPinned: (p: PerformanceItem) => boolean;
    onToggle: (p: PerformanceItem) => void;
  };
}

export function TripCalendar({ range, shows, performances, pinning }: Props) {
  const days = eachDayOfInterval({ start: parseISO(range.from), end: parseISO(range.to) }).map((d) =>
    format(d, "yyyy-MM-dd"),
  );
  const showById = new Map(shows.map((s, i) => [s.id, { ...s, color: SHOW_COLORS[i % SHOW_COLORS.length] }]));

  return (
    <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(22rem,1fr))]">
        {days.map((day) => (
          <div key={day} className="rounded-lg border bg-card">
            <div className="border-b px-3 py-2">
              <div className="font-medium">{format(parseISO(day), "EEEE")}</div>
              <div className="text-sm text-muted-foreground">{format(parseISO(day), "d MMMM")}</div>
            </div>
            {(["matinee", "evening"] as Slot[]).map((slot) => {
              const items = performances.filter((p) => p.localDate === day && p.slot === slot);
              return (
                <div key={slot} className="space-y-1.5 px-3 py-2 not-last:border-b">
                  <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{slot}</div>
                  {items.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((p) => {
                      const show = showById.get(p.showId);
                      if (!show) return null;
                      const pinned = pinning?.isPinned(p) ?? false;
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "group flex items-start rounded-md border-l-4 bg-muted/50 text-sm hover:bg-muted",
                            pinned && "bg-primary/10 ring-1 ring-primary/40 hover:bg-primary/15",
                          )}
                          style={{ borderLeftColor: show.color }}
                        >
                          <a
                            href={p.bookingUrl ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 px-2 py-1.5"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="leading-tight font-medium">{show.title}</span>
                              <ExternalLinkIcon className="mt-0.5 size-3 shrink-0 opacity-0 group-hover:opacity-60" />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.localTime}
                              {p.minPrice !== null && ` · from £${Number.isInteger(p.minPrice) ? p.minPrice : p.minPrice.toFixed(2)}`}
                            </div>
                          </a>
                          {pinning && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="m-1 shrink-0"
                              onClick={() => pinning.onToggle(p)}
                              aria-label={pinned ? `Remove ${show.title} from my plan` : `Pin ${show.title}`}
                              title={pinned ? "Remove from my plan" : "Pin to my plan"}
                            >
                              {pinned ? <XIcon /> : <PinIcon />}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
