import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanTitle, parseShowList, parseShowPage } from "@/scraper/sources/londontheatre";
import { showKey } from "@/scraper/sources/types";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("LTC show list (TodayTix API)", () => {
  const refs = parseShowList(JSON.parse(fixture("ltc-shows.json")));

  it("keeps shows, drops attractions and gift cards, and flags shows not on sale", () => {
    expect(refs.map((r) => [r.externalId, r.onSale]).sort()).toEqual([
      ["12634", true],
      ["287", true],
      ["44286", false],
      ["47411", true],
    ]);
  });

  it("links to the show page and strips company suffixes from titles", () => {
    expect(refs.find((r) => r.externalId === "12634")).toEqual({
      externalId: "12634",
      url: "https://www.londontheatre.co.uk/show/12634",
      title: "La traviata",
      onSale: true,
    });
    expect(refs.find((r) => r.externalId === "47411")!.title).toBe(
      "Feeling Afraid As If Something Terrible Is Going To Happen",
    );
  });
});

describe("cleanTitle", () => {
  it("makes LTC titles match OLT ones", () => {
    expect(showKey(cleanTitle("Tosca - English National Opera "))).toBe(showKey("Tosca"));
    expect(showKey(cleanTitle("As You Like It - Globe"))).toBe(showKey("As You Like It"));
    expect(cleanTitle("Spider-Man")).toBe("Spider-Man");
  });
});

describe("LTC show page", () => {
  const show = parseShowPage(fixture("ltc-show.html"), "https://www.londontheatre.co.uk/show/the-lion-king");

  it("extracts show metadata", () => {
    expect(show.externalId).toBe("302");
    expect(show.url).toBe("https://www.londontheatre.co.uk/show/302-the-lion-king-tickets");
    expect(show.title).toBe("The Lion King");
    expect(show.venue).toBe("Lyceum Theatre");
    expect(show.runningTime).toBe("2hr 30min. Incl. 1 interval.");
    expect(show.imageUrl).toMatch(/^https:\/\/images\.ctfassets\.net\/.+\.jpg$/);
  });

  it("extracts performances", () => {
    expect(show.performances).toHaveLength(263);
    expect(show.performances[0]).toEqual({
      startsAt: "2026-10-01T19:30:00.000+01:00",
      localDate: "2026-10-01",
      localTime: "19:30",
      minPrice: 57,
      bookingUrl: "https://www.londontheatre.co.uk/show/302-the-lion-king-tickets",
    });
  });
});
