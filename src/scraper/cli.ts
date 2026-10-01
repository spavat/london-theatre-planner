import { parseArgs } from "node:util";
import { db } from "@/db";
import { defaultScrapeOptions, sources } from "./defaults";
import { runScrape, ScrapeInProgressError } from "./orchestrator";

const { values } = parseArgs({
  options: {
    source: { type: "string" }, // force a single source, no fallback
    show: { type: "string" },
    limit: { type: "string" },
  },
});

const forced = values.source as keyof typeof sources | undefined;
if (forced && !sources[forced]) throw new Error(`Unknown source "${forced}", expected olt or ltc`);

try {
  const result = await runScrape(db, {
    ...defaultScrapeOptions,
    ...(forced && { primary: sources[forced], fallback: undefined }),
    trigger: "cli",
    filter: values.show,
    limit: values.limit ? Number(values.limit) : undefined,
  });
  console.log(
    `Run #${result.runId}: ${result.status}, ${result.showsOk} ok (${result.showsFallback} via fallback), ` +
      `${result.showsFailed} failed, ${result.warnings.length} warnings`,
  );
  process.exitCode = result.status === "failed" ? 1 : 0;
} catch (err) {
  if (!(err instanceof ScrapeInProgressError)) throw err;
  console.error(err.message);
  process.exitCode = 1;
}
