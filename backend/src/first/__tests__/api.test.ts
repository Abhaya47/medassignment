import { describe, it, expect } from "vitest";
import request from "supertest";
import path from "node:path";
import { loadCatalogFromFile, normalizeCatalog } from "../catalog/load-catalog";
import { createApp } from "../http/app";

const catalog = loadCatalogFromFile(
  path.resolve(__dirname, "../../../data/lab-catalog.json")
);
const app = createApp(catalog);

describe("GET /api/tests", () => {
  it("returns only selectable (active) tests", async () => {
    const res = await request(app).get("/api/tests");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(19);
    expect(res.body.find((t: any) => t.id === "T19")).toBeUndefined();
  });
});

describe("GET /api/packages", () => {
  it("returns only usable, cleaned packages", async () => {
    const res = await request(app).get("/api/packages");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12); // P10 is inactive
    expect(res.body.find((p: any) => p.id === "P10")).toBeUndefined();
    expect(res.body.find((p: any) => p.id === "P12").testIds).toEqual(["T13", "T17"]);
  });
});

describe("POST /api/plan", () => {
  it("200 with the expected plan", async () => {
    const res = await request(app)
      .post("/api/plan")
      .send({ testIds: ["T02", "T03", "T04", "T06"] });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1500);
    expect(res.body.savings).toBe(320);
  });

  it("400 EMPTY_SELECTION for {}", async () => {
    const res = await request(app).post("/api/plan").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "EMPTY_SELECTION", testIds: [] });
  });

  it("400 EMPTY_SELECTION for an empty array", async () => {
    const res = await request(app).post("/api/plan").send({ testIds: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EMPTY_SELECTION");
  });

  it("400 EMPTY_SELECTION when there is no body at all", async () => {
    const res = await request(app).post("/api/plan");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EMPTY_SELECTION");
  });

  it("400 INVALID_TESTS lists unknown and inactive IDs", async () => {
    const res = await request(app)
      .post("/api/plan")
      .send({ testIds: ["T02", "T19", "T99"] });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "INVALID_TESTS", testIds: ["T19", "T99"] });
  });

  it("400 BAD_REQUEST for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/plan")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("BAD_REQUEST");
  });

  it("422 NOT_AVAILABLE when a test can't be obtained", async () => {
    const small = createApp(
      normalizeCatalog({
        tests: [{ id: "T1", code: "A", name: "A", price: null, status: true }],
        packages: [],
      })
    );
    const res = await request(small).post("/api/plan").send({ testIds: ["T1"] });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "NOT_AVAILABLE", testIds: ["T1"] });
  });
});