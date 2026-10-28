export interface Test {
  id: string;
  code: string;
  name: string;
  price: number | null; // null = only available through a package
  status: boolean;
}

export interface RawPackage {
  id: string;
  name: string;
  price: number;
  testIds: string[];
  status: boolean;
}

export interface RawCatalog {
  tests: Test[];
  packages: RawPackage[];
}

// A package after normalization: active, deduped, valid IDs only.
export interface Package {
  id: string;
  name: string;
  price: number;
  testIds: string[];
}

export interface Catalog {
  tests: Test[];                 // all tests, including inactive
  testsById: Map<string, Test>;
  packages: Package[];           // active and cleaned
  warnings: string[];            // what the normalizer fixed or dropped
}