import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { toAvif } from "@/scraper/images";

describe("toAvif", () => {
  it("converts a JPEG to AVIF", async () => {
    const jpeg = await sharp({ create: { width: 8, height: 4, channels: 3, background: "#c00" } }).jpeg().toBuffer();
    const meta = await sharp(await toAvif(jpeg)).metadata();
    expect(meta).toMatchObject({ format: "heif", compression: "av1", width: 8, height: 4 });
  });

  it("rejects data that isn't an image", async () => {
    await expect(toAvif(new TextEncoder().encode("<html>Not found</html>"))).rejects.toThrow();
  });
});
