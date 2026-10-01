import type { SourceName } from "@/db/schema";

export interface ShowRef {
  externalId: string;
  url: string;
  title: string;
  /** false when the source lists the show but sells nothing for it right now. */
  onSale?: boolean;
}

export interface ScrapedPerformance {
  startsAt: string; // ISO 8601 with offset
  localDate: string; // YYYY-MM-DD (Europe/London)
  localTime: string; // HH:MM (Europe/London)
  minPrice: number | null;
  bookingUrl: string | null;
}

export interface ScrapedShow {
  externalId: string;
  url: string;
  title: string;
  venue: string | null;
  runningTime: string | null;
  imageUrl: string | null;
  performances: ScrapedPerformance[];
}

export interface Source {
  name: SourceName;
  listShows(): Promise<ShowRef[]>;
  fetchShow(ref: ShowRef): Promise<ScrapedShow>;
}

/**
 * Loose key used to recognise the same show across sources,
 * e.g. "Disney's The Lion King" and "The Lion King" → "lion-king".
 */
export function showKey(title: string): string {
  const stopWords = new Set(["the", "a", "an", "disneys", "musical"]);
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !stopWords.has(w))
    .join("-");
}

/**
 * Whether two titles from different sources are the same show: same key, or one key extends the other
 * ("Room On The Broom" / "Room on the Broom Live On Stage").
 */
export function sameShow(a: string, b: string): boolean {
  const [ka, kb] = [showKey(a), showKey(b)];
  return ka === kb || ka.startsWith(`${kb}-`) || kb.startsWith(`${ka}-`);
}
