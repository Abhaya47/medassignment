import express, { type NextFunction, type Request, type Response } from "express";
import type { Database } from "better-sqlite3";
import { ConflictError } from "../call-next";
import { makeService, patientDto } from "../service";
import { parseIso, type Clock } from "../time";
import { HttpError, validateCheckIn } from "../validate";

export interface AppDeps {
  db: Database;
  clock?: Clock;
  doctors?: string[];
  /** X-Now is honoured only outside production unless overridden. */
  allowXNow?: boolean;
}

export function createApp({
  db,
  clock = Date.now,
  doctors = ["D1", "D2"],
  allowXNow = process.env.NODE_ENV !== "production",
}: AppDeps) {
  const svc = makeService(db, doctors);
  const app = express();
  app.use(express.json());

  const nowOf = (req: Request) => {
    const h = req.header("X-Now");
    if (h && allowXNow) {
      const t = parseIso(h);
      if (Number.isNaN(t)) throw new HttpError(400, "X-Now must be an ISO date-time with an offset");
      return t;
    }
    return clock();
  };
  const doctorOf = (req: Request) => {
    const id = req.params.id;
    if (!doctors.includes(id)) throw new HttpError(404, `Unknown doctor '${id}'`);
    return id;
  };

  app.post("/api/check-ins", (req, res) => {
    const input = validateCheckIn(req.body);
    res.status(201).json(patientDto(svc.checkIn(input, nowOf(req))));
  });

  app.post("/api/doctors/:id/call-next", (req, res) => {
    const p = svc.callNext(doctorOf(req), nowOf(req));
    res.json({ patient: p ? patientDto(p) : null });
  });

  app.post("/api/doctors/:id/done", (req, res) => {
    res.json({ patient: patientDto(svc.done(doctorOf(req))) });
  });

  app.post("/api/doctors/:id/no-show", (req, res) => {
    res.json({ patient: patientDto(svc.noShow(doctorOf(req), nowOf(req))) });
  });

  app.get("/api/queue", (req, res) => {
    res.json(svc.queue(nowOf(req)));
  });

  app.use((_req, _res, next) => next(new HttpError(404, "Not found")));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
    if (err instanceof ConflictError) return res.status(409).json({ error: err.message });
    if ((err as any)?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}