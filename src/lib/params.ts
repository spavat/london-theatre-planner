const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads an optional YYYY-MM-DD query param. Throws on a malformed value. */
export function dateParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  if (value === null || value === "") return undefined;
  if (!DATE.test(value)) throw new BadRequest(`${name} must be YYYY-MM-DD`);
  return value;
}

export class BadRequest extends Error {}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}
