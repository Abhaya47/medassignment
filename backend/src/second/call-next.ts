import type { Database } from "better-sqlite3";
import { pickNext, type Rule, type Waiting } from "./queue-logic";

export class ConflictError extends Error {}

export interface PatientRow {
  id: number;
  token: string;
  name: string;
  age: number;
  kind: "emergency" | "appointment" | "walk_in";
  appointment_time: number | null;
  checked_in_at: number;
  queue_time: number;
  no_show_count: number;
  status: "waiting" | "serving" | "done" | "left";
  doctor_id: string | null;
}

export const toWaiting = (r: PatientRow): Waiting => ({
  id: r.id,
  kind: r.kind,
  age: r.age,
  appointmentTime: r.appointment_time,
  queueTime: r.queue_time,
});

/** Last 3 non-emergency call rules, oldest first. */
export function recentRules(db: Database): Rule[] {
  const rows = db
    .prepare("SELECT rule FROM calls WHERE rule != '3.1' ORDER BY id DESC LIMIT 3")
    .all() as { rule: Rule }[];
  return rows.map((r) => r.rule).reverse();
}

export function makeCallNext(db: Database) {
  const findBusy = db.prepare("SELECT id FROM patients WHERE status = 'serving' AND doctor_id = ?");
  const listWaiting = db.prepare("SELECT * FROM patients WHERE status = 'waiting'");
  const assign = db.prepare("UPDATE patients SET status = 'serving', doctor_id = ? WHERE id = ?");
  const logCall = db.prepare(
    "INSERT INTO calls (at, doctor_id, patient_id, rule) VALUES (?, ?, ?, ?)",
  );
  const reload = db.prepare("SELECT * FROM patients WHERE id = ?");

  const run = db.transaction((doctorId: string, now: number) => {
    if (findBusy.get(doctorId)) throw new ConflictError("Doctor is already seeing a patient");
    const rows = listWaiting.all() as PatientRow[];
    const pick = pickNext(rows.map(toWaiting), recentRules(db), now);
    if (!pick) return null;
    assign.run(doctorId, pick.patient.id); // pick, mark and log happen together
    logCall.run(now, doctorId, pick.patient.id, pick.rule);
    return reload.get(pick.patient.id) as PatientRow; // re-read so status is 'serving'
  });

  // .immediate() takes the write lock at the start, so even two server
  // processes couldn't both read the same "next" patient.
  return (doctorId: string, now: number) => run.immediate(doctorId, now);
}
