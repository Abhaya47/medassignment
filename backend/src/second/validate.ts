import { parseIso } from "./time";
import type { CheckInInput } from "./service";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: string[]) {
    super(message);
  }
}

export function validateCheckIn(body: any): CheckInInput {
  const errors: string[] = [];
  const b = body && typeof body === "object" ? body : {};

  if (typeof b.name !== "string" || b.name.trim() === "") errors.push("name is required");
  if (typeof b.age !== "number" || !Number.isInteger(b.age) || b.age < 0 || b.age > 120)
    errors.push("age must be a whole number between 0 and 120");
  if (b.kind !== "appointment" && b.kind !== "walk_in")
    errors.push("kind must be 'appointment' or 'walk_in'");
  if (b.emergency !== undefined && typeof b.emergency !== "boolean")
    errors.push("emergency must be a boolean");

  let appointmentTime: number | undefined;
  if (b.kind === "appointment") {
    if (b.appointmentTime === undefined || b.appointmentTime === null) {
      errors.push("appointmentTime is required for an appointment");
    } else {
      appointmentTime = parseIso(b.appointmentTime);
      if (Number.isNaN(appointmentTime))
        errors.push("appointmentTime must be an ISO date-time with an offset, e.g. 2026-11-02T09:00:00+05:45");
    }
  }

  if (errors.length) throw new HttpError(400, "Validation failed", errors);
  return { name: b.name.trim(), age: b.age, kind: b.kind, appointmentTime, emergency: b.emergency === true };
}