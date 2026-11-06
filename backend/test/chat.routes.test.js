const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const jwt = require("@fastify/jwt");
const chatRoutes = require("../src/routes/chat.routes");

const app = Fastify({ logger: false });

app.decorate("pgPool", {
  query: async (sql) => {
    if (sql.includes("COUNT(*)")) {
      return { rows: [{ total: 0 }], rowCount: 1 };
    }
    if (sql.includes("SELECT id, title, created_at, updated_at") &&
        sql.includes("chat_conversations")) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  },
});

test("setup chatbot test app", async () => {
  await app.register(jwt, {
    secret: "test-only-secret-that-is-at-least-40-characters-long",
  });
  await app.register(chatRoutes, { prefix: "/api/chat" });
  await app.ready();
});

function headers() {
  return {
    authorization: `Bearer ${app.jwt.sign({ sub: "1" })}`,
  };
}

test("conversation creation rejects missing JWT", async () => {
  const r = await app.inject({ method: "POST", url: "/api/chat/conversations" });
  assert.equal(r.statusCode, 401);
});

test("conversation creation rejects blank title", async () => {
  const r = await app.inject({
    method: "POST", url: "/api/chat/conversations",
    headers: headers(), payload: { title: "   " },
  });
  assert.equal(r.statusCode, 400);
});

test("conversation creation rejects oversized title", async () => {
  const r = await app.inject({
    method: "POST", url: "/api/chat/conversations",
    headers: headers(), payload: { title: "x".repeat(121) },
  });
  assert.equal(r.statusCode, 400);
});

test("conversation listing rejects missing JWT", async () => {
  const r = await app.inject({ method: "GET", url: "/api/chat/conversations" });
  assert.equal(r.statusCode, 401);
});

test("conversation listing rejects invalid pagination", async () => {
  for (const query of ["?limit=0", "?limit=101", "?limit=abc", "?offset=-1", "?offset=1.5"]) {
    const r = await app.inject({
      method: "GET", url: `/api/chat/conversations${query}`,
      headers: headers(),
    });
    assert.equal(r.statusCode, 400);
  }
});

test("conversation listing returns empty results", async () => {
  const r = await app.inject({
    method: "GET", url: "/api/chat/conversations",
    headers: headers(),
  });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.json().conversations, []);
  assert.equal(r.json().pagination.total, 0);
});

test("message history rejects missing JWT", async () => {
  const r = await app.inject({
    method: "GET", url: "/api/chat/conversations/1/messages",
  });
  assert.equal(r.statusCode, 401);
});

test("message history rejects invalid conversation IDs", async () => {
  for (const id of ["abc", "0", "-1", "1.5"]) {
    const r = await app.inject({
      method: "GET", url: `/api/chat/conversations/${id}/messages`,
      headers: headers(),
    });
    assert.equal(r.statusCode, 400);
  }
});

test("message history rejects invalid pagination", async () => {
  for (const query of ["?limit=0", "?limit=101", "?offset=-1"]) {
    const r = await app.inject({
      method: "GET",
      url: `/api/chat/conversations/1/messages${query}`,
      headers: headers(),
    });
    assert.equal(r.statusCode, 400);
  }
});

test("sending a message rejects missing JWT", async () => {
  const r = await app.inject({
    method: "POST", url: "/api/chat/conversations/1/messages",
    payload: { message: "Hello" },
  });
  assert.equal(r.statusCode, 401);
});

test("sending a message rejects invalid conversation ID", async () => {
  const r = await app.inject({
    method: "POST", url: "/api/chat/conversations/abc/messages",
    headers: headers(), payload: { message: "Hello" },
  });
  assert.equal(r.statusCode, 400);
});

test("sending a message rejects empty content", async () => {
  const r = await app.inject({
    method: "POST", url: "/api/chat/conversations/1/messages",
    headers: headers(), payload: { message: "   " },
  });
  assert.equal(r.statusCode, 400);
});

test("sending a message rejects content over 4000 characters", async () => {
  const r = await app.inject({
    method: "POST", url: "/api/chat/conversations/1/messages",
    headers: headers(), payload: { message: "x".repeat(4001) },
  });
  assert.equal(r.statusCode, 400);
});

test("conversation deletion rejects missing JWT", async () => {
  const r = await app.inject({
    method: "DELETE", url: "/api/chat/conversations/1",
  });
  assert.equal(r.statusCode, 401);
});

test("conversation deletion rejects invalid ID", async () => {
  const r = await app.inject({
    method: "DELETE", url: "/api/chat/conversations/abc",
    headers: headers(),
  });
  assert.equal(r.statusCode, 400);
});

test("conversation deletion returns 404 when not found", async () => {
  const r = await app.inject({
    method: "DELETE", url: "/api/chat/conversations/999",
    headers: headers(),
  });
  assert.equal(r.statusCode, 404);
});

after(async () => {
  await app.close();
});
