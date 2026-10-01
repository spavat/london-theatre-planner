import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  ok: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  fallback: "bg-sky-600/15 text-sky-700 dark:text-sky-400",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  running: "bg-blue-600/15 text-blue-700 dark:text-blue-400",
  failed: "bg-red-600/15 text-red-700 dark:text-red-400",
  interrupted: "bg-muted text-muted-foreground",
  empty: "bg-muted text-muted-foreground",
};

const LABELS: Record<string, string> = { empty: "no schedule" };

/** Colour-coded label for run statuses and per-show results. */
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("capitalize", STYLES[status])}>
      {LABELS[status] ?? status}
    </Badge>
  );
}
