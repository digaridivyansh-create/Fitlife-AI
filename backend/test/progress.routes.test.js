const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const jwt = require("@fastify/jwt");
const progressRoutes = require("../src/routes/progress.routes");

const app = Fastify({ logger: false });

app.decorate("pgPool", {
  query: async () => ({
    rows: [],
    rowCount: 0,
  }),
});

test("setup progress test app", async () => {
  await app.register(jwt, {
    secret: "test-only-secret-that-is-at-least-40-characters-long",
  });
  await app.register(progressRoutes, { prefix: "/api/progress" });
  await app.ready();
});

function token() {
  return app.jwt.sign({ sub: "1" });
}

const auth = () => ({
  authorization: `Bearer ${token()}`,
});

const post = async (url, payload) =>
  app.inject({
    method: "POST",
    url: `/api/progress${url}`,
    headers: auth(),
    payload,
  });

test("weight creation rejects missing JWT", async () => {
  const r = await app.inject({ method: "POST", url: "/api/progress/weight", payload: { weight_kg: 70 } });
  assert.equal(r.statusCode, 401);
});

test("weight creation rejects missing weight", async () => {
  assert.equal((await post("/weight", {})).statusCode, 400);
});

test("weight creation rejects weight below minimum", async () => {
  assert.equal((await post("/weight", { weight_kg: 19 })).statusCode, 400);
});

test("weight creation rejects weight above maximum", async () => {
  assert.equal((await post("/weight", { weight_kg: 501 })).statusCode, 400);
});

test("weight creation rejects invalid measurement date", async () => {
  assert.equal((await post("/weight", { weight_kg: 70, measured_at: "not-a-date" })).statusCode, 400);
});

test("weight creation rejects oversized notes", async () => {
  assert.equal((await post("/weight", { weight_kg: 70, notes: "A".repeat(501) })).statusCode, 400);
});

test("weight history rejects missing JWT", async () => {
  const r = await app.inject({ method: "GET", url: "/api/progress/weight" });
  assert.equal(r.statusCode, 401);
});

test("weight history rejects invalid limit", async () => {
  const r = await app.inject({ method: "GET", url: "/api/progress/weight?limit=101", headers: auth() });
  assert.equal(r.statusCode, 400);
});

test("completed workout rejects missing JWT", async () => {
  const r = await app.inject({ method: "POST", url: "/api/progress/workouts", payload: {} });
  assert.equal(r.statusCode, 401);
});

test("completed workout rejects missing name", async () => {
  assert.equal((await post("/workouts", { duration_minutes: 30 })).statusCode, 400);
});

test("completed workout rejects invalid duration", async () => {
  assert.equal((await post("/workouts", { workout_name: "Running", duration_minutes: 601 })).statusCode, 400);
});

test("completed workout rejects invalid plan ID", async () => {
  assert.equal((await post("/workouts", { workout_name: "Running", duration_minutes: 30, workout_plan_id: -1 })).statusCode, 400);
});

test("completed workout rejects invalid perceived effort", async () => {
  assert.equal((await post("/workouts", { workout_name: "Running", duration_minutes: 30, perceived_effort: 11 })).statusCode, 400);
});

test("completed workout rejects invalid calories", async () => {
  assert.equal((await post("/workouts", { workout_name: "Running", duration_minutes: 30, calories_burned: -1 })).statusCode, 400);
});

test("completed workout rejects completion date without timezone", async () => {
  assert.equal((await post("/workouts", { workout_name: "Running", duration_minutes: 30, completed_at: "2026-11-01T10:00:00" })).statusCode, 400);
});

test("daily progress rejects missing JWT", async () => {
  const r = await app.inject({ method: "PUT", url: "/api/progress/daily", payload: { steps: 1000 } });
  assert.equal(r.statusCode, 401);
});

test("daily progress rejects unsupported fields", async () => {
  assert.equal((await app.inject({ method: "PUT", url: "/api/progress/daily", headers: auth(), payload: { steps: 1000, unknown: true } })).statusCode, 400);
});

test("daily progress rejects invalid date", async () => {
  assert.equal((await app.inject({ method: "PUT", url: "/api/progress/daily", headers: auth(), payload: { progress_date: "2026-02-30", steps: 1000 } })).statusCode, 400);
});

test("daily progress rejects negative steps", async () => {
  assert.equal((await app.inject({ method: "PUT", url: "/api/progress/daily", headers: auth(), payload: { steps: -1 } })).statusCode, 400);
});

test("daily progress rejects empty update", async () => {
  assert.equal((await app.inject({ method: "PUT", url: "/api/progress/daily", headers: auth(), payload: {} })).statusCode, 400);
});

test("daily history rejects missing JWT", async () => {
  const r = await app.inject({ method: "GET", url: "/api/progress/daily" });
  assert.equal(r.statusCode, 401);
});

test("daily history rejects reversed date range", async () => {
  const r = await app.inject({ method: "GET", url: "/api/progress/daily?from=2026-11-10&to=2026-11-01", headers: auth() });
  assert.equal(r.statusCode, 400);
});

test("progress summary rejects missing JWT", async () => {
  const r = await app.inject({ method: "GET", url: "/api/progress/summary" });
  assert.equal(r.statusCode, 401);
});

test("progress summary rejects unsupported period", async () => {
  const r = await app.inject({ method: "GET", url: "/api/progress/summary?days=14", headers: auth() });
  assert.equal(r.statusCode, 400);
});

test("progress insights rejects unsupported period", async () => {
  const r = await app.inject({ method: "GET", url: "/api/progress/insights?days=14", headers: auth() });
  assert.equal(r.statusCode, 400);
});

after(async () => {
  await app.close();
});
