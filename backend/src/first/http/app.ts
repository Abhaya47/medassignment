import express, { type ErrorRequestHandler } from "express";
import type { Catalog } from "../catalog/types";
import { createPlan, PlanError } from "../plan/plan.service";

export function createApp(catalog: Catalog) {
  const app = express();
  app.use(express.json());

  // Only tests a customer can select (active ones).
  app.get("/api/tests", (_req, res) => {
    res.json(catalog.tests.filter((t) => t.status));
  });

  // Only packages that can be used (active, cleaned).
  app.get("/api/packages", (_req, res) => {
    res.json(catalog.packages);
  });

  app.post("/api/plan", (req, res) => {
    res.json(createPlan(catalog, req.body?.testIds));
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof PlanError) {
      res.status(err.status).json({ error: err.code, testIds: err.testIds });
      return;
    }
    // Malformed JSON body from express.json()
    if (err?.type === "entity.parse.failed") {
      res.status(400).json({ error: "BAD_REQUEST", testIds: [] });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "INTERNAL_ERROR", testIds: [] });
  };
  app.use(onError);

  return app;
}