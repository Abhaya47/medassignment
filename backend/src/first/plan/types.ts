import type { Package, Test } from "../catalog/types";

// A complete plan before it's shaped into the API response.
export interface Candidate {
  packages: Package[];
  tests: Test[];         // individually bought
  total: number;
  extraTests: string[];  // sorted, unique, not selected
  itemIds: string[];     // packages + tests, sorted alphabetically
}

export interface PlanItem {
  type: "package" | "test";
  id: string;
  name: string;
  price: number;
  covers: string[];
}

export interface PlanResponse {
  items: PlanItem[];
  total: number;
  extraTests: string[];
  individualTotal: number | null;
  savings: number | null;
}