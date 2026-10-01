import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseListPage, parseShowPage } from "@/scraper/sources/olt";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("OLT list page", () => {
  it("extracts one ref per show card", () => {
    const refs = parseListPage(fixture("olt-list.html"));
    expect(refs.length).toBeGreaterThan(100);
    expect(refs).toContainEqual({
      externalId: "92712",
      url: "https://officiallondontheatre.com/show/disneys-the-lion-king-92712/",
      title: "Disney’s The Lion King",
    });
  });
});

describe("OLT show page", () => {
  const url = "https://officiallondontheatre.com/show/disneys-the-lion-king-92712/";
  const show = parseShowPage(fixture("olt-show.html"), url);

  it("extracts show metadata", () => {
    expect(show.externalId).toBe("92712");
    expect(show.title).toBe("Disney’s The Lion King");
    expect(show.venue).toBe("Lyceum Theatre");
    expect(show.runningTime).toBe("2 hours and 30 minutes, including interval");
    expect(show.imageUrl).toBe("https://officiallondontheatre.com/app/uploads/2008/04/1200-x-600-1.jpg");
  });

  it("extracts performances", () => {
    expect(show.performances).toHaveLength(263);
    expect(show.performances[0]).toEqual({
      startsAt: "2026-10-01T19:30:00+01:00",
      localDate: "2026-10-01",
      localTime: "19:30",
      minPrice: 53,
      bookingUrl: "https://officiallondontheatre.seetickets.com/c2/event/disney-s-the-lion-king/lyceum-theatre/av-676891",
    });
  });
});

describe("OLT show page with a genre suffix in og:title", () => {
  it("reads the venue from the venue block", () => {
    const url = "https://officiallondontheatre.com/show/affluenza-111477444/";
    expect(parseShowPage(fixture("olt-show-affluenza.html"), url).venue).toBe("Riverside Studios");
  });
});

describe("OLT show page without a booking calendar", () => {
  const url = "https://officiallondontheatre.com/show/charlie-and-the-chocolate-factory-111476525/";
  const show = parseShowPage(fixture("olt-show-no-calendar.html"), url);

  it("is a valid show with no performances", () => {
    expect(show).toMatchObject({
      externalId: "111476525",
      title: "Charlie And The Chocolate Factory",
      venue: "London Coliseum",
      performances: [],
    });
  });

  it("still rejects pages that aren't show pages", () => {
    expect(() => parseShowPage("<html><body>Maintenance</body></html>", url)).toThrow("Unrecognised show page");
  });
});
