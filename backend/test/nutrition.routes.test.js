const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const jwt = require("@fastify/jwt");
const multipart = require("@fastify/multipart");
const nutritionRoutes = require("../src/routes/nutrition.routes");

const app = Fastify({ logger: false });

app.decorate("pgPool", {
  query: async (sql) => ({
    rows: sql.includes("COUNT(*)") ? [{ total: 0 }] : [],
    rowCount: 0,
  }),
});

test("setup nutrition test app", async () => {
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
  });
  await app.register(jwt, {
    secret: "test-only-secret-that-is-at-least-40-characters-long",
  });
  await app.register(nutritionRoutes, { prefix: "/api/nutrition" });
  await app.ready();
});

function authHeaders() {
  return {
    authorization: `Bearer ${app.jwt.sign({ sub: "1" })}`,
  };
}

test("nutrition analysis rejects missing JWT", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/nutrition/analyze",
  });
  assert.equal(response.statusCode, 401);
});

test("nutrition analysis rejects non-multipart request", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/nutrition/analyze",
    headers: authHeaders(),
  });
  assert.equal(response.statusCode, 400);
});

test("meal history rejects missing JWT", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/nutrition/history",
  });
  assert.equal(response.statusCode, 401);
});

test("meal history returns empty results with pagination", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/nutrition/history",
    headers: authHeaders(),
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().meals, []);
  assert.equal(response.json().pagination.total, 0);
});

test("meal history clamps page and limit to safe minimums", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/nutrition/history?page=-2&limit=-5",
    headers: authHeaders(),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().pagination.page, 1);
  assert.equal(response.json().pagination.limit, 1);
});

test("meal history caps limit at 50", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/nutrition/history?limit=500",
    headers: authHeaders(),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().pagination.limit, 50);
});

test("meal detail rejects missing JWT", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/nutrition/history/1",
  });
  assert.equal(response.statusCode, 401);
});

test("meal detail rejects invalid ID", async () => {
  for (const id of ["abc", "0", "-1", "1.5"]) {
    const response = await app.inject({
      method: "GET",
      url: `/api/nutrition/history/${id}`,
      headers: authHeaders(),
    });
    assert.equal(response.statusCode, 400);
  }
});

test("meal confirmation rejects missing JWT", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/nutrition/confirm",
    payload: { items: [] },
  });
  assert.equal(response.statusCode, 401);
});

test("meal confirmation rejects missing items", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/nutrition/confirm",
    headers: authHeaders(),
    payload: {},
  });
  assert.equal(response.statusCode, 400);
});

test("meal confirmation rejects empty item list", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/nutrition/confirm",
    headers: authHeaders(),
    payload: { items: [] },
  });
  assert.equal(response.statusCode, 400);
});

test("meal confirmation rejects more than 20 items", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/nutrition/confirm",
    headers: authHeaders(),
    payload: { items: Array(21).fill({}) },
  });
  assert.equal(response.statusCode, 400);
});

test("meal confirmation rejects blank meal name", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/nutrition/confirm",
    headers: authHeaders(),
    payload: { meal_name: "   ", items: [{}] },
  });
  assert.equal(response.statusCode, 400);
});

test("meal confirmation rejects oversized meal name", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/nutrition/confirm",
    headers: authHeaders(),
    payload: { meal_name: "x".repeat(121), items: [{}] },
  });
  assert.equal(response.statusCode, 400);
});

test("meal confirmation rejects invalid food item", async () => {
  const invalidItems = [
    { food_name: "", fdc_id: 1, serving_weight_g: 100 },
    { food_name: "Rice", fdc_id: 0, serving_weight_g: 100 },
    { food_name: "Rice", fdc_id: 1.5, serving_weight_g: 100 },
    { food_name: "Rice", fdc_id: 1, serving_weight_g: 0 },
    { food_name: "Rice", fdc_id: 1, serving_weight_g: 5001 },
    { food_name: "Rice", fdc_id: 1, serving_weight_g: "100" },
  ];

  for (const item of invalidItems) {
    const response = await app.inject({
      method: "POST",
      url: "/api/nutrition/confirm",
      headers: authHeaders(),
      payload: { items: [item] },
    });
    assert.equal(response.statusCode, 400);
  }
});

after(async () => {
  await app.close();
});

