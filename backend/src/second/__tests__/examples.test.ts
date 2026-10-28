import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../db";
import { makeService } from "../service";
import { parseIso } from "../time";

// backend/data/clinic.json, relative to backend/src/second/__tests__
const file = resolve(__dirname, "../../../data/clinic.json");
const data = JSON.parse(readFileSync(file, "utf8"));
const doctorIds: string[] = data.clinic.doctors.map((d: { id: string }) => d.id);

// "2026-11-02T09:00:00+05:45" -> "09:00" (the clinic-local clock time used in `expected.calls`)
const hhmm = (iso: string) => iso.slice(11, 16);

describe("replays every example in data/clinic.json", () => {
  data.examples.forEach((ex: any, i: number) => {
    it(`example ${i + 1}`, () => {
      const svc = makeService(openDb(":memory:"), doctorIds);
      const tokens: Record<string, string> = {};
      const calls: unknown[] = [];
      const snapshots: unknown[] = [];

      for (const e of ex.events) {
        const now = parseIso(e.at);
        switch (e.type) {
          case "check_in": {
            const p = e.patient;
            const row = svc.checkIn(
              {
                name: p.name,
                age: p.age,
                kind: p.kind,
                emergency: p.emergency === true,
                appointmentTime: p.appointmentTime ? parseIso(p.appointmentTime) : undefined,
              },
              now,
            );
            tokens[p.name] = row.token;
            break;
          }
          case "call_next": {
            const row = svc.callNext(e.doctorId, now);
            calls.push({ at: hhmm(e.at), doctorId: e.doctorId, token: row?.token ?? null, name: row?.name ?? null });
            break;
          }
          case "done":
            svc.done(e.doctorId);
            break;
          case "no_show":
            svc.noShow(e.doctorId, now);
            break;
          case "queue":
            snapshots.push({ at: e.at, queue: svc.queue(now).waiting });
            break;
          default:
            throw new Error(`unknown event type ${e.type}`);
        }
      }

      expect(tokens).toEqual(ex.expected.tokens);
      expect(calls).toEqual(ex.expected.calls);
      expect(snapshots).toEqual(ex.expected.queueSnapshots);
    });
  });
});