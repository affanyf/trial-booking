/**
 * Route params and JSON bodies arrive as strings/numbers; our IDs are
 * Postgres BIGINT (Prisma BigInt). This rejects anything that isn't a
 * positive integer before it ever reaches a query.
 */
export function parseId(raw: unknown): bigint | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  if (!/^\d+$/.test(String(raw))) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}
