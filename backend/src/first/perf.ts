import path from "node:path";
import { loadCatalogFromFile, normalizeCatalog } from "./catalog/load-catalog";
import { createPlan } from "./plan/plan.service";
import type { RawPackage, Test } from "./catalog/types";

function time(label: string, fn: () => void) {
  const s = performance.now();
  fn();
  console.log(`${label}: ${(performance.now() - s).toFixed(1)} ms`);
}

// Real catalog, everything selected.
const real = loadCatalogFromFile(path.resolve(__dirname, "../../data/lab-catalog.json"));
const all = real.tests.filter((t) => t.status).map((t) => t.id);
time(`real catalog (${real.packages.length} packages, ${all.length} tests)`, () =>
  createPlan(real, all)
);

// Synthetic catalogs with n packages, 19 tests, deterministic pseudo-random coverage.
function synthetic(n: number) {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const tests: Test[] = Array.from({ length: 19 }, (_, i) => ({
    id: `T${i + 1}`, code: `C${i + 1}`, name: `T${i + 1}`, price: 100 + i * 10, status: true,
  }));
  const packages: RawPackage[] = Array.from({ length: n }, (_, i) => {
    const ids = tests.filter(() => rnd() < 0.25).map((t) => t.id);
    if (ids.length === 0) ids.push("T1");
    const sum = ids.reduce((a, id) => a + tests.find((t) => t.id === id)!.price!, 0);
    return { id: `P${String(i + 1).padStart(2, "0")}`, name: `P${i}`, price: Math.round(sum * 0.7), testIds: ids, status: true };
  });
  return normalizeCatalog({ tests, packages });
}

for (const n of [13, 16, 18, 20, 22]) {
  const c = synthetic(n);
  time(`synthetic ${n} packages`, () => createPlan(c, c.tests.map((t) => t.id)));
}