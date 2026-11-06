const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const jwt = require("@fastify/jwt");
const proposalRoutes = require("../src/routes/workout-proposal.routes");

const app = Fastify({ logger: false });

app.decorate("pgPool", {
  query: async () => ({ rows: [], rowCount: 0 }),
});

test("setup proposal test app", async () => {
  await app.register(jwt, {
    secret: "test-only-secret-that-is-at-least-40-characters-long",
  });
  await app.register(proposalRoutes, { prefix: "/api/workouts" });
  await app.ready();
});

test("proposal creation rejects missing JWT", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/workouts/1/proposals",
    payload: { change_request: "Make this workout easier" },
  });
  assert.equal(response.statusCode, 401);
});

test("proposal creation rejects invalid workout plan ID", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "POST",
    url: "/api/workouts/abc/proposals",
    headers: { authorization: `Bearer ${token}` },
    payload: { change_request: "Make this workout easier" },
  });
  assert.equal(response.statusCode, 400);
});

test("proposal creation rejects missing change request", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "POST",
    url: "/api/workouts/1/proposals",
    headers: { authorization: `Bearer ${token}` },
    payload: {},
  });
  assert.equal(response.statusCode, 400);
});

test("proposal creation rejects short change request", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "POST",
    url: "/api/workouts/1/proposals",
    headers: { authorization: `Bearer ${token}` },
    payload: { change_request: "No" },
  });
  assert.equal(response.statusCode, 400);
});

test("proposal creation rejects oversized change request", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "POST",
    url: "/api/workouts/1/proposals",
    headers: { authorization: `Bearer ${token}` },
    payload: { change_request: "A".repeat(2001) },
  });
  assert.equal(response.statusCode, 400);
});

test("proposal approval rejects missing JWT", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/workouts/proposals/1/approve",
  });
  assert.equal(response.statusCode, 401);
});

test("proposal approval rejects invalid proposal ID", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "POST",
    url: "/api/workouts/proposals/abc/approve",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 400);
});

test("proposal rejection rejects missing JWT", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/workouts/proposals/1/reject",
  });
  assert.equal(response.statusCode, 401);
});

test("proposal rejection rejects invalid proposal ID", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "POST",
    url: "/api/workouts/proposals/abc/reject",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 400);
});

test("proposal listing rejects missing JWT", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/workouts/proposals",
  });
  assert.equal(response.statusCode, 401);
});

test("proposal listing returns empty history", async () => {
  const token = app.jwt.sign({ sub: "1" });
  const response = await app.inject({
    method: "GET",
    url: "/api/workouts/proposals",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().proposals, []);
  assert.equal(response.json().pagination.count, 0);
});

after(async () => {
  await app.close();
});
