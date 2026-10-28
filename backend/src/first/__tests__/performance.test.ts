import { it, expect } from "vitest";
import path from "node:path";
import { loadCatalogFromFile } from "../catalog/load-catalog";
import { createPlan } from "../plan/plan.service";

const catalog = loadCatalogFromFile(
  path.resolve(__dirname, "../../../data/lab-catalog.json")
);

it("worst case (all 19 selectable tests) is well under 300 ms", () => {
  const all = catalog.tests.filter((t) => t.status).map((t) => t.id);
  const start = performance.now();
  createPlan(catalog, all);
  expect(performance.now() - start).toBeLessThan(300);
});