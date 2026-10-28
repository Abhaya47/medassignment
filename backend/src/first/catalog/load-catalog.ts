import { readFileSync } from "node:fs";
import type { Catalog, Package, RawCatalog } from "./types";

export function normalizeCatalog(raw: RawCatalog): Catalog {
  const warnings: string[] = [];
  const testsById = new Map(raw.tests.map((t) => [t.id, t]));
  const packages: Package[] = [];

  for (const p of raw.packages) {
    if (!p.status) continue; // inactive packages can't be used

    const seen = new Set<string>();
    const testIds: string[] = [];

    for (const id of p.testIds) {
      if (!testsById.has(id)) {
        warnings.push(`Package ${p.id}: unknown test ${id} ignored`);
        continue;
      }
      if (seen.has(id)) {
        warnings.push(`Package ${p.id}: duplicate test ${id} ignored`);
        continue;
      }
      seen.add(id);
      testIds.push(id);
    }

    if (testIds.length === 0) {
      warnings.push(`Package ${p.id}: no valid tests, dropped`);
      continue;
    }

    packages.push({ id: p.id, name: p.name, price: p.price, testIds });
  }

  return { tests: raw.tests, testsById, packages, warnings };
}

export function loadCatalogFromFile(path: string): Catalog {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as RawCatalog;
  return normalizeCatalog(raw);
}