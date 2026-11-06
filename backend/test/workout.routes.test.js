const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const jwt = require("@fastify/jwt");
const workoutRoutes = require("../src/routes/workout.routes");

const app = Fastify({ logger: false });

app.decorate("pgPool", {
  query: async () => ({
    rows: [],
    rowCount: 0,
  }),
});

test("setup workout test app", async () => {
  await app.register(jwt, {
    secret: "test-only-secret-that-is-at-least-40-characters-long",
  });
  await app.register(workoutRoutes, { prefix: "/api/workouts" });
  await app.ready();
});

test("workout history rejects missing JWT", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/workouts/",
  });
  assert.equal(response.statusCode, 401);
});

test("workout history rejects invalid limit", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "GET",
    url: "/api/workouts/?limit=500",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 400);
});

test("workout history rejects negative offset", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "GET",
    url: "/api/workouts/?offset=-1",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 400);
});

test("workout detail rejects invalid plan ID", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "GET",
    url: "/api/workouts/abc",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 400);
});

test("workout history returns empty list when no plans exist", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "GET",
    url: "/api/workouts/",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().plans, []);
  assert.equal(response.json().count, 0);
});

after(async () => {
  await app.close();
});
