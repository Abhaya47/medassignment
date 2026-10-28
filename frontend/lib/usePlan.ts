"use client";
import { useEffect, useState } from "react";
import { ApiError, fetchPlan, type Plan } from "./api";

export type PlanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; plan: Plan }
  | { status: "error"; error: ApiError };

export function usePlan(selectedIds: string[]): PlanState {
  const [state, setState] = useState<PlanState>({ status: "idle" });
  const key = selectedIds.join(",");

  useEffect(() => {
    if (!key) {
      setState({ status: "idle" });
      return;
    }
    const ids = key.split(",");
    const controller = new AbortController();
    setState({ status: "loading" }); // old plan is cleared immediately

    const timer = setTimeout(async () => {
      try {
        const plan = await fetchPlan(ids, controller.signal);
        if (!controller.signal.aborted) setState({ status: "success", plan });
      } catch (e) {
        if (controller.signal.aborted) return; // superseded request
        setState({ status: "error", error: e instanceof ApiError ? e : new ApiError("SERVER") });
      }
    }, 200);

    // Runs on every selection change: cancel the timer and the in-flight request.
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  return state;
}