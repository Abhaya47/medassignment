import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadCatalogFromFile } from "../catalog/load-catalog";
import { createPlan, PlanError } from "../plan/plan.service";

// Use the same path expression that works in your catalog.test.ts
const DATA_PATH = path.resolve(__dirname, "../../../data/lab-catalog.json");

const catalog = loadCatalogFromFile(DATA_PATH);
const { examples } = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

describe("data file examples", () => {
  examples.forEach((ex: any, i: number) => {
    it(`example ${i + 1}: ${ex.request.testIds.join(",")}`, () => {
      expect(createPlan(catalog, ex.request.testIds)).toEqual(ex.expected);
    });
  });
});

describe("validation", () => {
  const code = (input: unknown) => {
    try { createPlan(catalog, input); } catch (e) {
      if (e instanceof PlanError) return { code: e.code, ids: e.testIds };
      throw e;
    }
  };

  it("empty selection", () => {
    expect(code([])?.code).toBe("EMPTY_SELECTION");
    expect(code(undefined)?.code).toBe("EMPTY_SELECTION");
  });

  it("unknown and inactive tests", () => {
    expect(code(["T02", "T19", "T99"])).toEqual({ code: "INVALID_TESTS", ids: ["T19", "T99"] });
  });

  it("counts a duplicated selection once", () => {
    const plan = createPlan(catalog, ["T02", "T02", "T03"]);
    expect(plan.items[0].covers).toEqual(["T02", "T03"]);
  });
});