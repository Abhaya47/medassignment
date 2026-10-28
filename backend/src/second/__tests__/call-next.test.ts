import { describe, expect, it } from "vitest";
import { ConflictError, makeCallNext } from "../call-next";
import { openDb } from "../db";

const NOW = Date.parse("2026-11-02T09:30:00+05:45");

function setup(...names: string[]) {
  const db = openDb(":memory:");
  const insert = db.prepare(
    `INSERT INTO patients (token, name, age, kind, checked_in_at, queue_time)
     VALUES (?, ?, 30, 'walk_in', ?, ?)`,
  );
  // check-ins one minute apart, so the order is deterministic
  names.forEach((n, i) => {
    const t = NOW - (names.length - i) * 60_000;
    insert.run(`W-00${i + 1}`, n, t, t);
  });
  return makeCallNext(db);
}

describe("call next", () => {
  it("two doctors get different patients", () => {
    const callNext = setup("Ram", "Sita");
    const a = callNext("D1", NOW)!;
    const b = callNext("D2", NOW)!;
    expect(a.name).toBe("Ram");
    expect(b.name).toBe("Sita");
    expect(a.id).not.toBe(b.id);
    expect(a.status).toBe("serving"); // returned row is re-read after the update
    expect(a.doctor_id).toBe("D1");
  });

  it("one patient, two doctors: only one gets them", () => {
    const callNext = setup("Ram");
    const results = [callNext("D1", NOW), callNext("D2", NOW)];
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect(results[1]).toBeNull();
  });

  it("a doctor who is busy gets a conflict", () => {
    const callNext = setup("Ram", "Sita");
    callNext("D1", NOW);
    expect(() => callNext("D1", NOW)).toThrow(ConflictError);
  });
});