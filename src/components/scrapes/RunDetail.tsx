import { AlertTriangleIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ScrapeRunDetail, ScrapeShowResult } from "@/lib/api-types";
import { formatDiff, formatDuration } from "./format";
import { StatusBadge } from "./StatusBadge";

const FILTERS = {
  all: { label: "All", test: () => true },
  failed: { label: "Failed", test: (r: ScrapeShowResult) => r.result === "failed" },
  fallback: { label: "Fallback", test: (r: ScrapeShowResult) => r.result === "fallback" },
  empty: { label: "No schedule", test: (r: ScrapeShowResult) => r.result === "empty" },
  changed: { label: "Changed", test: (r: ScrapeShowResult) => r.performancesAdded + r.performancesRemoved > 0 },
  images: { label: "Image issues", test: (r: ScrapeShowResult) => r.imageStatus === "failed" },
} satisfies Record<string, { label: string; test: (r: ScrapeShowResult) => boolean }>;

type FilterKey = keyof typeof FILTERS;

export function RunDetail({ detail }: { detail: ScrapeRunDetail }) {
  const { run, results } = detail;
  const [filter, setFilter] = useState<FilterKey>("all");
  const visible = results.filter(FILTERS[filter].test);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Run #{run.id}</h2>
        <StatusBadge status={run.status} />
        <span className="text-sm text-muted-foreground">
          Listed from {run.listSource ?? "—"} · {run.imagesStored} images stored
          {run.imagesFailed > 0 && `, ${run.imagesFailed} failed`}
        </span>
      </div>

      {run.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {run.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              {w}
            </li>
          ))}
        </ul>
      )}
      {run.errorLog && (
        <ul className="space-y-1 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {run.errorLog.split("\n").map((e) => (
            <li key={e} className="flex gap-2">
              <XCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
              {e}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
          <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
            {FILTERS[key].label} ({results.filter(FILTERS[key].test).length})
          </Button>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Show</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Performances</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead>Image</TableHead>
              <TableHead className="text-right">Time</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nothing here.
                </TableCell>
              </TableRow>
            )}
            {visible.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-64 truncate font-medium">
                  <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline" title={r.title}>
                    {r.title}
                  </a>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.result} />
                </TableCell>
                <TableCell className="uppercase text-muted-foreground">{r.source ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.result === "failed" ? "—" : r.performances}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDiff(r.performancesAdded, r.performancesRemoved)}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.imageStatus}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDuration(r.durationMs)}</TableCell>
                <TableCell className="max-w-md text-sm whitespace-normal text-muted-foreground">
                  {r.error ?? (r.fallbackReason && `Primary failed: ${r.fallbackReason}`)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
