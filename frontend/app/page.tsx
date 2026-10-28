"use client";
import { useEffect, useMemo, useState } from "react";
import { ApiError, fetchTests, type Test } from "@/lib/api";
import { errorMessage } from "@/lib/messages";
import { usePlan } from "@/lib/usePlan";
import styles from "./page.module.css";

const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

export default function Home() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [loadingTests, setLoadingTests] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const load = () => {
    setLoadingTests(true);
    setLoadError(null);
    fetchTests()
      .then(setTests)
      .catch((e) => setLoadError(e instanceof ApiError ? e : new ApiError("SERVER")))
      .finally(() => setLoadingTests(false));
  };
  useEffect(load, []);

  const byId = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  }, [tests, query]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const plan = usePlan(selected);

  return (
    <main className={styles.main}>
      <h1>Lab test bundle finder</h1>
      <p className={styles.sub}>Pick the tests you need and we'll find the cheapest way to book them.</p>

      <section>
        <label htmlFor="search" className={styles.label}>Search tests</label>
        <input
          id="search"
          className={styles.input}
          placeholder="Name or code, e.g. HbA1c"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {loadingTests && <p>Loading tests…</p>}
        {loadError && (
          <p role="alert" className={styles.error}>
            {errorMessage(loadError, nameOf)} <button onClick={load}>Retry</button>
          </p>
        )}
        {!loadingTests && !loadError && matches.length === 0 && <p>No tests match “{query}”.</p>}

        <ul className={styles.list}>
          {matches.map((t) => {
            const on = selected.includes(t.id);
            return (
              <li key={t.id}>
                <button
                  className={on ? styles.rowOn : styles.row}
                  aria-pressed={on}
                  onClick={() => toggle(t.id)}
                >
                  <span>{t.name} <small>({t.code})</small></span>
                  <span>{on ? "✓ Added" : "Add"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2>Your selection</h2>
        {selected.length === 0 ? (
          <p className={styles.muted}>No tests selected yet.</p>
        ) : (
          <ul className={styles.chips}>
            {selected.map((id) => (
              <li key={id} className={styles.chip}>
                {nameOf(id)}
                <button aria-label={`Remove ${nameOf(id)}`} onClick={() => toggle(id)}>×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-live="polite">
        <h2>Cheapest plan</h2>
        {plan.status === "idle" && <p className={styles.muted}>Select a test to see your plan.</p>}
        {plan.status === "loading" && <p>Finding the cheapest option…</p>}
        {plan.status === "error" && (
          <p role="alert" className={styles.error}>{errorMessage(plan.error, nameOf)}</p>
        )}
        {plan.status === "success" && (
          <div>
            <ul className={styles.items}>
              {plan.plan.items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <div className={styles.itemHead}>
                    <strong>{item.name}</strong>
                    <span>{baht(item.price)}</span>
                  </div>
                  <small>
                    {item.type === "package" ? "Package" : "Single test"} · covers{" "}
                    {item.covers.map(nameOf).join(", ")}
                  </small>
                </li>
              ))}
            </ul>

            {plan.plan.extraTests.length > 0 && (
              <p className={styles.bonus}>
                Also included: {plan.plan.extraTests.map(nameOf).join(", ")}
              </p>
            )}

            <div className={styles.total}>
              <span>Total</span>
              <strong>{baht(plan.plan.total)}</strong>
            </div>
            {plan.plan.savings !== null && plan.plan.savings > 0 && (
              <p className={styles.savings}>
                You save {baht(plan.plan.savings)} compared with booking each test separately.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}