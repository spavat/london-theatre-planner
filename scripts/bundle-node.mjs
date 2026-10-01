// Bundles the Node entry points that live outside Astro (startup + scrape CLI) into dist/, so the
// production image runs plain JS. Dependencies stay external and come from node_modules.
import { build } from "esbuild";

await build({
  entryPoints: { boot: "src/boot.ts", scrape: "src/scraper/cli.ts" },
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  logLevel: "info",
});
