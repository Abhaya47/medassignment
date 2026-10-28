import Database from "better-sqlite3";
 
export function openDb(file = "clinic.db") {
  const db = new Database(file); // use ":memory:" in tests
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      token            TEXT NOT NULL,
      name             TEXT NOT NULL,
      age              INTEGER NOT NULL,
      kind             TEXT NOT NULL,            -- emergency | appointment | walk_in (current group)
      appointment_time INTEGER,                  -- epoch ms, only for kind = appointment
      checked_in_at    INTEGER NOT NULL,         -- original check-in, never changes
      queue_time       INTEGER NOT NULL,         -- ordering time; reset to now on a first no-show
      no_show_count    INTEGER NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'waiting', -- waiting | serving | done | left
      doctor_id        TEXT                      -- set while status = 'serving'
    );
    CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
 
    -- one row per (clinic-local day, letter); n is the last number issued
    CREATE TABLE IF NOT EXISTS token_counters (
      day    INTEGER NOT NULL,
      letter TEXT NOT NULL,
      n      INTEGER NOT NULL,
      PRIMARY KEY (day, letter)
    );
 
    -- every call, with the rule that picked it (needed for fairness)
    CREATE TABLE IF NOT EXISTS calls (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      at         INTEGER NOT NULL,
      doctor_id  TEXT NOT NULL,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      rule       TEXT NOT NULL
    );
  `);
  return db;
}
