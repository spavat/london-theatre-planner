import * as cheerio from "cheerio";
import { fetchText } from "../http";
import type { ScrapedShow, ShowRef, Source } from "./types";

const BASE = "https://officiallondontheatre.com";

interface OltPerformance {
  id: string;
  date: string;
  iso: string;
  time: string;
  min: number | null;
  bookUrl: string | null;
}

export function parseListPage(html: string): ShowRef[] {
  const $ = cheerio.load(html);
  const refs = new Map<string, ShowRef>();
  $("article.shows-grid-item").each((_, el) => {
    const card = $(el);
    const externalId = card.attr("data-post-id");
    const url = card.find("a.shows-grid-item__link").attr("href");
    const title = card.attr("data-name");
    if (externalId && url && title) refs.set(externalId, { externalId, url, title });
  });
  return [...refs.values()];
}

export function parseShowPage(html: string, url: string): ScrapedShow {
  const $ = cheerio.load(html);
  const venueBlock = $(".show-details__venue-content-venue-name").first();
  // Without the venue block this isn't a show page we understand: a real error, not "no performances".
  if (venueBlock.length === 0) throw new Error(`Unrecognised show page ${url}`);
  const venue = venueBlock.text().trim() || null;

  // Shows not on sale have no booking calendar: a valid page with zero performances.
  const calAttr = $("[data-cal]").first().attr("data-cal");
  const cal: { showId: number; showName: string; performances: OltPerformance[] } | null = calAttr
    ? JSON.parse(calAttr)
    : null;
  // og:title looks like "Charlie And The Chocolate Factory Tickets | London Coliseum"
  const ogTitle = $('meta[property="og:title"]').attr("content") ?? "";

  const runningTime =
    $(".show-important-information__item-content")
      .filter((_, el) => $(el).find(".h4").text().trim() === "Running Time")
      .find("p")
      .first()
      .text()
      .trim() || null;

  return {
    externalId: cal ? String(cal.showId) : (url.match(/-(\d+)\/?$/)?.[1] ?? url),
    url,
    title: cal?.showName ?? ogTitle.split(" | ")[0].replace(/ Tickets$/, ""),
    venue,
    runningTime,
    imageUrl: $('meta[property="og:image"]').attr("content") ?? null,
    performances: (cal?.performances ?? []).map((p) => ({
      startsAt: p.iso,
      localDate: p.date,
      localTime: p.time,
      minPrice: p.min ?? null,
      bookingUrl: p.bookUrl ?? null,
    })),
  };
}

export const olt: Source = {
  name: "olt",
  async listShows() {
    return parseListPage(await fetchText(`${BASE}/theatre-tickets/`));
  },
  async fetchShow(ref) {
    return parseShowPage(await fetchText(ref.url), ref.url);
  },
};
