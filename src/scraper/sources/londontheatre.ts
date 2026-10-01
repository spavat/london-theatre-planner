import { fetchText } from "../http";
import type { ScrapedShow, ShowRef, Source } from "./types";

const BASE = "https://www.londontheatre.co.uk";

interface LtcShowtime {
  datetime: string;
  localDate: string;
  localTime: string;
  regularTickets?: { lowPriceForShowtimeSelection?: { value: number } | null } | null;
}

function nextData(html: string): any {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("No __NEXT_DATA__ found");
  return JSON.parse(match[1]).props.pageProps;
}

/** "Tosca - English National Opera " → "Tosca", so titles match OLT's. */
export function cleanTitle(name: string): string {
  return name.replace(/\s+-\s+.*$/, "").trim();
}

interface TodayTixProduct {
  id: number;
  name: string;
  productType: string;
  areRegularTicketsAvailable: boolean;
}

/** Shows (not attractions or gift cards), from the TodayTix API behind the site. */
export function parseShowList(products: TodayTixProduct[]): ShowRef[] {
  return products
    .filter((p) => p.productType === "SHOW")
    .map((p) => ({
      externalId: String(p.id),
      // Redirects to the canonical /show/<id>-<slug> page.
      url: `${BASE}/show/${p.id}`,
      title: cleanTitle(p.name),
      onSale: p.areRegularTicketsAvailable,
    }));
}

export function parseShowPage(html: string, url: string): ScrapedShow {
  const props = nextData(html);
  const product = props.product;
  if (!product) throw new Error(`No product data on ${url}`);
  const showtimes: LtcShowtime[] = props.initialShowtimes ?? [];
  const heroUrl: string | undefined = product.heroImage?.file?.url;

  return {
    externalId: String(product.id),
    url: props.canonicalUrl ?? url,
    title: cleanTitle(product.name),
    venue: product.venue?.name ?? null,
    runningTime: product.runTimeAndIntermission ?? null,
    imageUrl: heroUrl ? (heroUrl.startsWith("//") ? `https:${heroUrl}` : heroUrl) : null,
    performances: showtimes.map((s) => ({
      startsAt: s.datetime,
      localDate: s.localDate,
      localTime: s.localTime,
      minPrice: s.regularTickets?.lowPriceForShowtimeSelection?.value ?? null,
      // No per-performance booking link; the show page has the booking calendar.
      bookingUrl: props.canonicalUrl ?? url,
    })),
  };
}

// London (location 2). The site's own what's-on page loads its list from here.
const SHOWS_API = "https://api.todaytix.com/api/v2/shows?fieldset=SHOW_SUMMARY&location=2";
const PAGE_SIZE = 200;

export const londontheatre: Source = {
  name: "ltc",
  async listShows() {
    const products: TodayTixProduct[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = JSON.parse(await fetchText(`${SHOWS_API}&limit=${PAGE_SIZE}&offset=${offset}`));
      products.push(...page.data);
      if (products.length >= page.pagination.total || page.data.length === 0) break;
    }
    return parseShowList(products);
  },
  async fetchShow(ref) {
    return parseShowPage(await fetchText(ref.url), ref.url);
  },
};
