import type { Catalog } from "../catalog/types";
import { comparePlans } from "./compare-plans";
import type { Candidate } from "./types";

// `selected` must already be validated and deduped.
// Returns null if no combination covers every selected test.
export function findCheapestPlan(catalog: Catalog, selected: string[]): Candidate | null {
  const bitOf = new Map(selected.map((id, i) => [id, 1 << i]));
  const fullMask = (1 << selected.length) - 1;
  const priceOf = selected.map((id) => catalog.testsById.get(id)!.price);

  // Each package becomes a mask of the *selected* tests it covers.
  // Packages that cover none of them can never help, so drop them.
  const relevant = catalog.packages
    .map((pkg) => {
      let mask = 0;
      for (const id of pkg.testIds) mask |= bitOf.get(id) ?? 0;
      return { pkg, mask };
    })
    .filter((r) => r.mask !== 0);

  let best: Candidate | null = null;

  // A plan is fully determined by which packages it uses; anything left
  // uncovered is bought individually. So enumerate package subsets.
  for (let s = 0; s < 1 << relevant.length; s++) {
    let covered = 0;
    let total = 0;
    for (let i = 0; i < relevant.length; i++) {
      if (s & (1 << i)) {
        covered |= relevant[i].mask;
        total += relevant[i].pkg.price;
      }
    }

    // Price whatever the packages left uncovered.
    let feasible = true;
    for (let i = 0; i < selected.length; i++) {
      if (fullMask & ~covered & (1 << i)) {
        const price = priceOf[i];
        if (price === null) { feasible = false; break; }
        total += price;
      }
    }
    if (!feasible) continue;
    if (best && total > best.total) continue; // cheap prune before building

    const candidate = buildCandidate(catalog, selected, bitOf, relevant, s, covered, total);
    if (!best || comparePlans(candidate, best) < 0) best = candidate;
  }

  return best;
}

function buildCandidate(
  catalog: Catalog,
  selected: string[],
  bitOf: Map<string, number>,
  relevant: { pkg: Candidate["packages"][number]; mask: number }[],
  subset: number,
  covered: number,
  total: number
): Candidate {
  const packages = relevant.filter((_, i) => subset & (1 << i)).map((r) => r.pkg);
  const tests = selected
    .filter((_, i) => !(covered & (1 << i)))
    .map((id) => catalog.testsById.get(id)!);

  const extras = new Set<string>();
  for (const pkg of packages) {
    for (const id of pkg.testIds) if (!bitOf.has(id)) extras.add(id);
  }

  return {
    packages,
    tests,
    total,
    extraTests: [...extras].sort(),
    itemIds: [...packages.map((p) => p.id), ...tests.map((t) => t.id)].sort(),
  };
}