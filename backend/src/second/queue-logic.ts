// Pure queue rules. No DB, no clock: everything is passed in, so it is trivial to test.
export type Kind = "emergency" | "appointment" | "walk_in";
/** Which rule picked a call. 3.1 emergency, 3.2 due appointment, 3.3 walk-in, 3.4 early appointment. */
export type Rule = "3.1" | "3.2" | "3.3" | "3.4";

export interface Waiting {
  id: number;
  kind: Kind;
  age: number;
  appointmentTime: number | null; // epoch ms
  queueTime: number; // check-in time, or the no-show time after a first no-show
}

export const DUE_WINDOW_MS = 10 * 60_000;
export const LATE_GRACE_MS = 15 * 60_000;
export const MINUTES_PER_SLOT = 12;
export const FAIRNESS_STREAK = 3;
export const SENIOR_AGE = 65;

const byQueue = (a: Waiting, b: Waiting) => a.queueTime - b.queueTime || a.id - b.id;
const byAppt = (a: Waiting, b: Waiting) =>
  a.appointmentTime! - b.appointmentTime! || byQueue(a, b);
const byWalkIn = (a: Waiting, b: Waiting) =>
  Number(b.age >= SENIOR_AGE) - Number(a.age >= SENIOR_AGE) || byQueue(a, b);

/** True if a check-in this long after the appointment still counts as on time (exactly 15 min is on time). */
export const isLate = (checkIn: number, appt: number) => checkIn - appt > LATE_GRACE_MS;

/**
 * history = rules of past calls, oldest first (all doctors together).
 * Emergency calls (3.1) are ignored for fairness; a 3.4 call is not a 3.2 call, so it breaks a streak.
 */
export function pickNext(
  waiting: Waiting[],
  history: Rule[],
  now: number,
): { patient: Waiting; rule: Rule } | null {
  const emergencies = waiting.filter((p) => p.kind === "emergency").sort(byQueue);
  if (emergencies.length) return { patient: emergencies[0], rule: "3.1" };

  const appts = waiting.filter((p) => p.kind === "appointment");
  const walkIns = waiting.filter((p) => p.kind === "walk_in").sort(byWalkIn);
  const due = appts.filter((p) => p.appointmentTime! <= now + DUE_WINDOW_MS).sort(byAppt);

  if (due.length) {
    const last = history.filter((r) => r !== "3.1").slice(-FAIRNESS_STREAK);
    const starving = last.length === FAIRNESS_STREAK && last.every((r) => r === "3.2");
    if (starving && walkIns.length) return { patient: walkIns[0], rule: "3.3" };
    return { patient: due[0], rule: "3.2" };
  }
  if (walkIns.length) return { patient: walkIns[0], rule: "3.3" };
  if (appts.length) return { patient: [...appts].sort(byAppt)[0], rule: "3.4" };
  return null;
}

/** Rule 6: simulate pressing Call next repeatedly at the same `now`, fairness included. */
export function orderQueue(waiting: Waiting[], history: Rule[], now: number): Waiting[] {
  const rest = [...waiting];
  const hist = [...history];
  const out: Waiting[] = [];
  for (;;) {
    const pick = pickNext(rest, hist, now);
    if (!pick) return out;
    out.push(pick.patient);
    hist.push(pick.rule);
    rest.splice(rest.indexOf(pick.patient), 1);
  }
}

export const estimatedWaitMinutes = (position: number, doctorCount: number) =>
  Math.floor(position / doctorCount) * MINUTES_PER_SLOT;
