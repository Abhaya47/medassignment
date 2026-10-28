import type { Database } from "better-sqlite3";
import { ConflictError, makeCallNext, recentRules, toWaiting, type PatientRow } from "./call-next";
import { estimatedWaitMinutes, isLate, orderQueue, type Kind } from "./queue-logic";
import { localDay, toLocalIso } from "./time";

export interface CheckInInput {
  name: string;
  age: number;
  kind: "appointment" | "walk_in";
  appointmentTime?: number; // epoch ms
  emergency?: boolean;
}

const LETTER: Record<Kind, string> = { emergency: "E", appointment: "A", walk_in: "W" };

export function patientDto(r: PatientRow) {
  return {
    id: r.id,
    token: r.token,
    name: r.name,
    age: r.age,
    group: r.kind,
    appointmentTime: r.appointment_time == null ? null : toLocalIso(r.appointment_time),
    checkedInAt: toLocalIso(r.checked_in_at),
    status: r.status,
    doctorId: r.doctor_id,
    noShowCount: r.no_show_count,
  };
}

export function makeService(db: Database, doctors: string[]) {
  const callNext = makeCallNext(db);
  const bump = db.prepare(
    `INSERT INTO token_counters (day, letter, n) VALUES (?, ?, 1)
     ON CONFLICT(day, letter) DO UPDATE SET n = n + 1`,
  );
  const readCounter = db.prepare("SELECT n FROM token_counters WHERE day = ? AND letter = ?");
  const insert = db.prepare(
    `INSERT INTO patients (token, name, age, kind, appointment_time, checked_in_at, queue_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const byId = db.prepare("SELECT * FROM patients WHERE id = ?");
  const serving = db.prepare("SELECT * FROM patients WHERE status = 'serving' AND doctor_id = ?");

  const checkInTx = db.transaction((input: CheckInInput, now: number) => {
    let kind: Kind;
    if (input.emergency) kind = "emergency";
    else if (input.kind === "appointment" && !isLate(now, input.appointmentTime!)) kind = "appointment";
    else kind = "walk_in"; // walk-in, or an appointment more than 15 minutes late
    const letter = LETTER[kind];
    const day = localDay(now);
    bump.run(day, letter);
    const n = (readCounter.get(day, letter) as { n: number }).n;
    const token = `${letter}-${String(n).padStart(3, "0")}`;
    const appt = kind === "appointment" ? input.appointmentTime! : null;
    const info = insert.run(token, input.name.trim(), input.age, kind, appt, now, now);
    return byId.get(info.lastInsertRowid) as PatientRow;
  });

  const noShowTx = db.transaction((doctorId: string, now: number) => {
    const p = serving.get(doctorId) as PatientRow | undefined;
    if (!p) throw new ConflictError("Doctor has no patient to mark as no-show");
    if (p.no_show_count === 0) {
      // first time: back to the queue as a walk-in, same token, queue time = now
      db.prepare(
        `UPDATE patients SET status='waiting', doctor_id=NULL, kind='walk_in',
         appointment_time=NULL, queue_time=?, no_show_count=1 WHERE id=?`,
      ).run(now, p.id);
    } else {
      db.prepare("UPDATE patients SET status='left', doctor_id=NULL, no_show_count=no_show_count+1 WHERE id=?").run(p.id);
    }
    return byId.get(p.id) as PatientRow;
  });

  const doneTx = db.transaction((doctorId: string) => {
    const p = serving.get(doctorId) as PatientRow | undefined;
    if (!p) throw new ConflictError("Doctor has no patient to finish");
    db.prepare("UPDATE patients SET status='done', doctor_id=NULL WHERE id=?").run(p.id);
    return byId.get(p.id) as PatientRow;
  });

  return {
    checkIn: (input: CheckInInput, now: number) => checkInTx.immediate(input, now),
    callNext: (doctorId: string, now: number) => callNext(doctorId, now),
    done: (doctorId: string) => doneTx.immediate(doctorId),
    noShow: (doctorId: string, now: number) => noShowTx.immediate(doctorId, now),
    queue(now: number) {
      const waitingRows = db.prepare("SELECT * FROM patients WHERE status = 'waiting'").all() as PatientRow[];
      const rowById = new Map(waitingRows.map((r) => [r.id, r]));
      const ordered = orderQueue(waitingRows.map(toWaiting), recentRules(db), now);
      const servingRows = db
        .prepare("SELECT * FROM patients WHERE status = 'serving' ORDER BY doctor_id")
        .all() as PatientRow[];
      return {
        nowServing: servingRows.map((r) => ({ doctorId: r.doctor_id, token: r.token, name: r.name })),
        // position is 0-based (0 and 1 are "Next" with two doctors)
        waiting: ordered.map((w, position) => {
          const r = rowById.get(w.id)!;
          return {
            position,
            token: r.token,
            name: r.name,
            estimatedWaitMinutes: estimatedWaitMinutes(position, doctors.length),
          };
        }),
      };
    },
  };
}
