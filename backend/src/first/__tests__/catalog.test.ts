import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadCatalogFromFile } from "../catalog/load-catalog";

const catalog = loadCatalogFromFile(
  path.resolve(__dirname, "../../../data/lab-catalog.json")
);

describe("normalizeCatalog", () => {
  it("dedupes repeated test IDs (P06)", () => {
    const p06 = catalog.packages.find((p) => p.id === "P06")!;
    expect(p06.testIds).toEqual(["T01", "T02", "T04", "T05", "T06", "T11", "T12"]);
  });

  it("ignores unknown test IDs but keeps the package (P12)", () => {
    const p12 = catalog.packages.find((p) => p.id === "P12")!;
    expect(p12.testIds).toEqual(["T13", "T17"]);
  });

  it("drops inactive packages (P10)", () => {
    expect(catalog.packages.find((p) => p.id === "P10")).toBeUndefined();
  });

  it("reports what it fixed", () => {
    expect(catalog.warnings.length).toBe(2);
  });
});