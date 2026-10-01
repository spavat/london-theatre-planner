import type { Slot } from "@/db/schema";

/** "14:30" → matinee, "19:30" → evening. Anything starting before 17:00 counts as a matinee. */
export function slotFor(localTime: string): Slot {
  return localTime < "17:00" ? "matinee" : "evening";
}
