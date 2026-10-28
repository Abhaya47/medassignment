export interface Test { id: string; code: string; name: string; price: number | null }

export interface PlanItem {
  type: "package" | "test";
  id: string;
  name: string;
  price: number;
  covers: string[];
}

export interface Plan {
  items: PlanItem[];
  total: number;
  extraTests: string[];
  individualTotal: number | null;
  savings: number | null;
}

export class ApiError extends Error {
  constructor(public code: string, public testIds: string[] = []) {
    super(code);
  }
}

export async function fetchTests(): Promise<Test[]> {
  let res: Response;
  try {
    res = await fetch("/api/tests");
  } catch {
    throw new ApiError("NETWORK");
  }
  if (!res.ok) throw new ApiError("SERVER");
  return res.json();
}

export async function fetchPlan(testIds: string[], signal: AbortSignal): Promise<Plan> {
  let res: Response;
  try {
    res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testIds }),
      signal,
    });
  } catch (e) {
    if (signal.aborted) throw e; // caller ignores aborts
    throw new ApiError("NETWORK");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? "SERVER", body?.testIds ?? []);
  return body as Plan;
}