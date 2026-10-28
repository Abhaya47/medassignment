import type { Catalog } from "../catalog/types";
import { findCheapestPlan } from "./cheapest-plan";
import type { PlanItem, PlanResponse } from "./types";

export type PlanErrorCode = "EMPTY_SELECTION" | "INVALID_TESTS" | "NOT_AVAILABLE";

export class PlanError extends Error {
  constructor(
    public code: PlanErrorCode,
    public status: 400 | 422,
    public testIds: string[] = []
  ) {
    super(code);
  }
}

export function createPlan(catalog: Catalog, input: unknown): PlanResponse {
  if (!Array.isArray(input) || input.length === 0) {
    throw new PlanError("EMPTY_SELECTION", 400);
  }

  // Same test selected twice counts once; keep first-seen order.
  const selected = [...new Set(input.map(String))];

  const invalid = selected.filter((id) => !catalog.testsById.get(id)?.status);
  if (invalid.length) throw new PlanError("INVALID_TESTS", 400, invalid);

  // Tests with no price are only obtainable through some package.
  const inPackage = new Set(catalog.packages.flatMap((p) => p.testIds));
  const unobtainable = selected.filter(
    (id) => catalog.testsById.get(id)!.price === null && !inPackage.has(id)
  );
  if (unobtainable.length) throw new PlanError("NOT_AVAILABLE", 422, unobtainable);

  const best = findCheapestPlan(catalog, selected);
  if (!best) throw new PlanError("NOT_AVAILABLE", 422, selected);

  const items: PlanItem[] = [
    ...best.packages.map((p) => ({
      type: "package" as const,
      id: p.id,
      name: p.name,
      price: p.price,
      covers: selected.filter((id) => p.testIds.includes(id)),
    })),
    ...best.tests.map((t) => ({
      type: "test" as const,
      id: t.id,
      name: t.name,
      price: t.price!,
      covers: [t.id],
    })),
  ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const prices = selected.map((id) => catalog.testsById.get(id)!.price);
  const individualTotal = prices.every((p) => p !== null)
    ? (prices as number[]).reduce((a, b) => a + b, 0)
    : null;

  return {
    items,
    total: best.total,
    extraTests: best.extraTests,
    individualTotal,
    savings: individualTotal === null ? null : individualTotal - best.total,
  };
}