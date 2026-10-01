import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ScrapeRun } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDiff, formatDuration } from "./format";
import { StatusBadge } from "./StatusBadge";

interface Props {
  runs: ScrapeRun[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function RunsTable({ runs, selectedId, onSelect }: Props) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Shows ok</TableHead>
            <TableHead className="text-right">Fallback</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead className="text-right">Performances</TableHead>
            <TableHead className="text-right">Warnings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow
              key={run.id}
              onClick={() => onSelect(run.id)}
              data-state={run.id === selectedId ? "selected" : undefined}
              className="cursor-pointer"
            >
              <TableCell className="font-medium">#{run.id}</TableCell>
              <TableCell>{formatDateTime(run.startedAt)}</TableCell>
              <TableCell className="uppercase text-muted-foreground">{run.trigger}</TableCell>
              <TableCell className="text-muted-foreground">{run.scope ?? "full"}</TableCell>
              <TableCell>
                {run.finishedAt ? formatDuration(Date.parse(run.finishedAt) - Date.parse(run.startedAt)) : "…"}
              </TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {run.showsOk}/{run.showsListed}
              </TableCell>
              <TableCell className="text-right tabular-nums">{run.showsFallback || "—"}</TableCell>
              <TableCell className={cn("text-right tabular-nums", run.showsFailed > 0 && "text-red-600 dark:text-red-400")}>
                {run.showsFailed || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatDiff(run.performancesAdded, run.performancesRemoved)}
              </TableCell>
              <TableCell
                className={cn("text-right tabular-nums", run.warnings.length > 0 && "text-amber-600 dark:text-amber-400")}
              >
                {run.warnings.length || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
