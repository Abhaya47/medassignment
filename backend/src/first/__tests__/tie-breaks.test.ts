import { describe, it, expect } from "vitest";
import { comparePlans } from "../plan/compare-plans";
import { normalizeCatalog } from "../catalog/load-catalog";
import { createPlan, PlanError } from "../plan/plan.service";
import type { Candidate } from "../plan/types";
import type { RawPackage, Test } from "../catalog/types";

// ---------- helpers ----------
const cand = (total: number, itemIds: string[], extraTests: string[] = []): Candidate => ({
  packages: [],
  tests: [],
  total,
  itemIds,
  extraTests,
});

const t = (id: string, price: number | null, status = true): Test => ({
  id,
  code: id,
  name: id,
  price,
  status,
});

const p = (id: string, price: number, testIds: string[], status = true): RawPackage => ({
  id,
  name: id,
  price,
  testIds,
  status,
});

const build = (tests: Test[], packages: RawPackage[]) =>
  normalizeCatalog({ tests, packages });

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof PlanError) return { code: e.code, status: e.status, ids: e.testIds };
    throw e;
  }
};

// ---------- comparePlans in isolation ----------
describe("comparePlans", () => {
  it("lower total wins", () => {
    expect(comparePlans(cand(100, ["A", "B"]), cand(200, ["A"]))).toBeLessThan(0);
  });

  it("same total: fewer items wins", () => {
    expect(comparePlans(cand(100, ["A"]), cand(100, ["A", "B"]))).toBeLessThan(0);
  });

  it("same total and items: fewer extras wins", () => {
    expect(comparePlans(cand(100, ["A"], []), cand(100, ["B"], ["T9"]))).toBeLessThan(0);
  });

  it("everything equal: alphabetically first item IDs win", () => {
    expect(comparePlans(cand(100, ["P01", "T02"]), cand(100, ["P01", "T03"]))).toBeLessThan(0);
    expect(comparePlans(cand(100, ["P02"]), cand(100, ["P01"]))).toBeGreaterThan(0);
  });

  it("identical plans return 0", () => {
    expect(comparePlans(cand(100, ["P01"]), cand(100, ["P01"]))).toBe(0);
  });

  it("earlier rules beat later ones", () => {
    // cheaper wins even with more items and more extras
    expect(comparePlans(cand(100, ["A", "B", "C"], ["X", "Y"]), cand(101, ["A"]))).toBeLessThan(0);
  });
});

// ---------- tie-breaks through the real search ----------
describe("tie-breaks end to end", () => {
  it("equal price: fewer items wins (one package vs two single tests)", () => {
    const c = build([t("T1", 100), t("T2", 100)], [p("PA", 200, ["T1", "T2"])]);
    const plan = createPlan(c, ["T1", "T2"]);
    expect(plan.items.map((i) => i.id)).toEqual(["PA"]);
  });

  it("equal price and items: fewer extra tests wins", () => {
    const c = build(
      [t("T1", 500), t("T2", 500)],
      [p("PA", 100, ["T1", "T2"]), p("PB", 100, ["T1"])]
    );
    const plan = createPlan(c, ["T1"]);
    expect(plan.items.map((i) => i.id)).toEqual(["PB"]);
    expect(plan.extraTests).toEqual([]);
  });

  it("everything else equal: alphabetically first item ID wins", () => {
    const c = build([t("T1", 500)], [p("PB", 100, ["T1"]), p("PA", 100, ["T1"])]);
    const plan = createPlan(c, ["T1"]);
    expect(plan.items.map((i) => i.id)).toEqual(["PA"]);
  });

  it("an extra test shared by two packages is listed once", () => {
    const c = build(
      [t("T1", 500), t("T2", 500), t("T3", 50)],
      [p("PA", 100, ["T1", "T3"]), p("PB", 100, ["T2", "T3"])]
    );
    const plan = createPlan(c, ["T1", "T2"]);
    expect(plan.items.map((i) => i.id)).toEqual(["PA", "PB"]);
    expect(plan.extraTests).toEqual(["T3"]);
  });

  it("does not buy a test individually when a package already covers it", () => {
    const c = build(
      [t("T1", 100), t("T2", 100)],
      [p("PA", 150, ["T1", "T2"])]
    );
    const plan = createPlan(c, ["T1", "T2"]);
    expect(plan.items).toHaveLength(1);
    expect(plan.total).toBe(150);
  });
});

// ---------- NOT_AVAILABLE ----------
describe("NOT_AVAILABLE", () => {
  it("price-null test that is in no package", () => {
    const c = build([t("T1", 100), t("T2", null)], []);
    expect(errorOf(() => createPlan(c, ["T1", "T2"]))).toEqual({
      code: "NOT_AVAILABLE",
      status: 422,
      ids: ["T2"],
    });
  });

  it("price-null test only in an inactive package", () => {
    const c = build([t("T2", null)], [p("PX", 100, ["T2"], false)]);
    expect(errorOf(() => createPlan(c, ["T2"]))?.code).toBe("NOT_AVAILABLE");
  });

  it("price-null test whose package becomes empty after cleanup", () => {
    const c = build([t("T2", null)], [p("PX", 100, ["T99"])]);
    expect(errorOf(() => createPlan(c, ["T2"]))?.code).toBe("NOT_AVAILABLE");
  });

  it("null-priced test is fine when a package covers it, and savings are null", () => {
    const c = build([t("T1", 100), t("T2", null)], [p("PA", 150, ["T1", "T2"])]);
    const plan = createPlan(c, ["T1", "T2"]);
    expect(plan.total).toBe(150);
    expect(plan.individualTotal).toBeNull();
    expect(plan.savings).toBeNull();
  });
});