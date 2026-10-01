import { describe, expect, it } from "vitest";
import { slotFor } from "@/lib/slots";
import { sameShow, showKey } from "@/scraper/sources/types";

describe("slotFor", () => {
  it("classifies afternoon starts as matinee", () => {
    expect(slotFor("14:30")).toBe("matinee");
    expect(slotFor("15:00")).toBe("matinee");
    expect(slotFor("16:59")).toBe("matinee");
  });
  it("classifies starts from 17:00 as evening", () => {
    expect(slotFor("17:00")).toBe("evening");
    expect(slotFor("19:30")).toBe("evening");
  });
});

describe("showKey", () => {
  it("matches titles that differ only in branding and articles", () => {
    expect(showKey("Disney’s The Lion King")).toBe("lion-king");
    expect(showKey("The Lion King")).toBe("lion-king");
    expect(showKey("Les Misérables")).toBe("les-miserables");
    expect(showKey("Mamma Mia! The Musical")).toBe("mamma-mia");
  });
});

describe("sameShow", () => {
  it("matches titles where one extends the other", () => {
    expect(sameShow("Harry Potter And The Cursed Child (One Part)", "Harry Potter and the Cursed Child")).toBe(true);
    expect(sameShow("Little Dancer", "Little Dancer: A New Musical")).toBe(true);
  });
  it("does not match on a partial word", () => {
    expect(sameShow("Cats", "Catsville")).toBe(false);
    expect(sameShow("Hamlet", "Macbeth")).toBe(false);
  });
});
