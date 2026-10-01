import { storeShowImage } from "./images";
import type { ScrapeOptions } from "./orchestrator";
import { londontheatre } from "./sources/londontheatre";
import { olt } from "./sources/olt";

export const sources = { olt, ltc: londontheatre };

/** OLT first, London Theatre as per-show fallback. */
export const defaultScrapeOptions = {
  primary: olt,
  fallback: londontheatre,
  storeImage: storeShowImage,
} satisfies Partial<ScrapeOptions>;
