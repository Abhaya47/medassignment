// All timestamps are stored as epoch milliseconds (UTC). Kathmandu is a fixed
// UTC+05:45 with no DST, so a constant offset is safe.
export const KTM_OFFSET_MS = (5 * 60 + 45) * 60_000;
const DAY_MS = 86_400_000;

export type Clock = () => number;

/** Index of the clinic-local day (Asia/Kathmandu). Changes at local midnight. */
export const localDay = (ms: number) => Math.floor((ms + KTM_OFFSET_MS) / DAY_MS);

/** Epoch ms -> "2026-11-02T09:00:00+05:45" */
export const toLocalIso = (ms: number) =>
  new Date(ms + KTM_OFFSET_MS).toISOString().slice(0, 19) + "+05:45";

/** Parse an ISO string that carries an explicit offset (Z or +hh:mm). NaN if invalid. */
export function parseIso(s: unknown): number {
  if (typeof s !== "string") return NaN;
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(s)) return NaN; // refuse offset-less strings: ambiguous
  return Date.parse(s);
}