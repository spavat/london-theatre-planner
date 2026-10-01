import { describe, expect, it } from "vitest";
import { withFolder } from "@/lib/s3";

describe("withFolder", () => {
  it("leaves keys alone without a folder", () => {
    expect(withFolder("shows/x.avif", "")).toBe("shows/x.avif");
  });
  it("prefixes keys with the folder, ignoring stray slashes", () => {
    expect(withFolder("shows/x.avif", "london-theatre-planner")).toBe("london-theatre-planner/shows/x.avif");
    expect(withFolder("shows/x.avif", "/london-theatre-planner/")).toBe("london-theatre-planner/shows/x.avif");
  });
});
