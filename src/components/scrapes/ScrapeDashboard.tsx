import { formatDistanceToNow, parseISO } from "date-fns";
import { LoaderCircleIcon, PlayIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ScrapeOverview, ScrapeRunDetail } from "@/lib/api-types";
import { RunDetail } from "./RunDetail";
import { RunsTable } from "./RunsTable";

const POLL_MS = 3000;

export function ScrapeDashboard() {
  const [overview, setOverview] = useState<ScrapeOverview | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ScrapeRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/scrapes");
      if (!res.ok) throw new Error(`/api/scrapes → HTTP ${res.status}`);
      const data: ScrapeOverview = await res.json();
      setOverview(data);
      setSelectedId((id) => id ?? data.runs[0]?.id ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const running = overview?.runs.find((r) => r.status === "running");
  const selectedRun = overview?.runs.find((r) => r.id === selectedId);

  // Poll while a run is in progress so counts and per-show rows appear live.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [running?.id, refresh]);

  // Reload the detail when another run is selected or the selected run's counters move.
  useEffect(() => {
    if (selectedId === null) return;
    fetch(`/api/scrapes/${selectedId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(setDetail)
      .catch((err) => setError(err.message));
  }, [selectedId, selectedRun?.status, selectedRun?.showsOk, selectedRun?.showsFailed]);

  const start = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/scrapes", { method: "POST", headers: { "x-scrape-token": token } });
    const body = await res.json();
    if (!res.ok && res.status !== 409) return setError(body.error ?? `HTTP ${res.status}`);
    setSelectedId(body.id);
    await refresh();
  };

  if (!overview) return error ? <p className="text-destructive">{error}</p> : null;
  const { stats } = overview;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Last successful full scrape</CardDescription>
            <CardTitle className="text-xl">
              {stats.lastSuccessAt ? `${formatDistanceToNow(parseISO(stats.lastSuccessAt))} ago` : "Never"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Shows with upcoming performances</CardDescription>
            <CardTitle className="text-xl tabular-nums">{stats.shows}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Upcoming performances</CardDescription>
            <CardTitle className="text-xl tabular-nums">{stats.performances.toLocaleString("en-GB")}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{running ? `Run #${running.id} in progress` : "Scrape all shows now"}</CardDescription>
          </CardHeader>
          <CardContent>
            {running ? (
              <Button disabled className="w-full">
                <LoaderCircleIcon className="animate-spin" />
                Scraping… {running.showsOk + running.showsFailed}/{running.showsListed || "?"}
              </Button>
            ) : (
              <form onSubmit={start} className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Scrape token"
                  aria-label="Scrape token"
                  autoComplete="current-password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <Button type="submit" disabled={!token}>
                  <PlayIcon />
                  Run scrape
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {overview.runs.length === 0 ? (
        <p className="text-muted-foreground">No scrapes yet.</p>
      ) : (
        <>
          <RunsTable runs={overview.runs} selectedId={selectedId} onSelect={setSelectedId} />
          {detail && detail.run.id === selectedId && <RunDetail key={detail.run.id} detail={detail} />}
        </>
      )}
    </div>
  );
}
