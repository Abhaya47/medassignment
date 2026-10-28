import type { Candidate } from "./types";

// Negative if `a` is the better plan, positive if `b` is, 0 if identical.
export function comparePlans(a: Candidate, b: Candidate): number {
  if (a.total !== b.total) return a.total - b.total;
  if (a.itemIds.length !== b.itemIds.length) return a.itemIds.length - b.itemIds.length;
  if (a.extraTests.length !== b.extraTests.length) return a.extraTests.length - b.extraTests.length;
  for (let i = 0; i < a.itemIds.length; i++) {
    if (a.itemIds[i] !== b.itemIds[i]) return a.itemIds[i] < b.itemIds[i] ? -1 : 1;
  }
  return 0;
}