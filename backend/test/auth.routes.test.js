const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const jwt = require("@fastify/jwt");
const authRoutes = require("../src/routes/auth.routes");

const app = Fastify({ logger: false });

app.decorate("pgPool", {
  query: async () => ({ rowCount: 0, rows: [] }),
});

test("setup Fastify authentication test app", async () => {
  await app.register(jwt, { secret: "test-only-secret-that-is-at-least-40-characters-long" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.ready();
});

test("registration rejects missing fields", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {},
  });
  assert.equal(response.statusCode, 400);
});

test("registration rejects invalid email", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "invalid-email", password: "password123" },
  });
  assert.equal(response.statusCode, 400);
});

test("registration rejects short password", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "test@example.com", password: "123" },
  });
  assert.equal(response.statusCode, 400);
});

test("login rejects missing credentials", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {},
  });
  assert.equal(response.statusCode, 400);
});

test("login rejects invalid email", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "invalid", password: "password123" },
  });
  assert.equal(response.statusCode, 400);
});

test("profile endpoint rejects missing JWT", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/auth/profile",
  });
  assert.equal(response.statusCode, 401);
});

test("profile update rejects unsupported fields", async () => {
  const token = app.jwt.sign({ sub: "1", email: "test@example.com" });
  const response = await app.inject({
    method: "PUT",
    url: "/api/auth/profile",
    headers: { authorization: `Bearer ${token}` },
    payload: { unsupported_field: "value" },
  });
  assert.equal(response.statusCode, 400);
});

test("profile update rejects invalid height", async () => {
  const token = app.jwt.sign({ sub: "1", email: "test@example.com" });
  const response = await app.inject({
    method: "PUT",
    url: "/api/auth/profile",
    headers: { authorization: `Bearer ${token}` },
    payload: { height_cm: 999 },
  });
  assert.equal(response.statusCode, 400);
});

after(async () => {
  await app.close();
});
