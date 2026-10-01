import { format, parseISO } from "date-fns";

export const formatDateTime = (iso: string) => format(parseISO(iso), "EEE d MMM, HH:mm");

export function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function formatDiff(added: number, removed: number) {
  if (!added && !removed) return "—";
  return [added && `+${added}`, removed && `−${removed}`].filter(Boolean).join(" ");
}
