const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const jwt = require("@fastify/jwt");
const multipart = require("@fastify/multipart");
const formAnalysisRoutes = require("../src/routes/form-analysis.routes");

const app = Fastify({ logger: false });

const originalFetch = global.fetch;
const originalToken = process.env.AI_SERVICE_TOKEN;
const originalServiceUrl = process.env.AI_SERVICE_URL;

app.decorate("pgPool", {
  query: async () => ({ rows: [], rowCount: 0 }),
});

test("setup form analysis test app", async () => {
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
      fields: 0,
    },
  });

  await app.register(jwt, {
    secret: "test-only-secret-that-is-at-least-40-characters-long",
  });

  await app.register(formAnalysisRoutes, {
    prefix: "/api/form-analysis",
  });

  await app.ready();
});

function authHeaders() {
  return {
    authorization: `Bearer ${app.jwt.sign({ sub: "1" })}`,
  };
}

function multipartVideo({
  filename = "exercise.mp4",
  mimetype = "video/mp4",
  content = "test-video-content",
} = {}) {
  const boundary = "form-analysis-test-boundary";

  const body = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="video"; filename="${filename}"\r\n` +
      `Content-Type: ${mimetype}\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--\r\n`
  );

  return {
    payload: body,
    headers: {
      ...authHeaders(),
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
  };
}

test("form analysis rejects missing JWT", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/form-analysis/analyze-video",
  });

  assert.equal(response.statusCode, 401);
});

test("form analysis rejects non-multipart request", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/form-analysis/analyze-video",
    headers: authHeaders(),
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /MP4 exercise video/i);
});

test("form analysis rejects unsupported video MIME types", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/form-analysis/analyze-video",
    ...multipartVideo({
      filename: "exercise.jpg",
      mimetype: "image/jpeg",
    }),
  });

  assert.equal(response.statusCode, 415);
  assert.match(response.json().error, /MP4/i);
});

test("form analysis returns 503 when AI service token is missing", async () => {
  delete process.env.AI_SERVICE_TOKEN;

  const response = await app.inject({
    method: "POST",
    url: "/api/form-analysis/analyze-video",
    ...multipartVideo(),
  });

  assert.equal(response.statusCode, 503);
  assert.match(response.json().error, /temporarily unavailable/i);

  if (originalToken === undefined) {
    delete process.env.AI_SERVICE_TOKEN;
  } else {
    process.env.AI_SERVICE_TOKEN = originalToken;
  }
});

test("form analysis forwards MP4 video and returns AI result", async () => {
  process.env.AI_SERVICE_TOKEN = "test-ai-service-token";
  process.env.AI_SERVICE_URL = "http://127.0.0.1:8001/";

  const expectedAnalysis = {
    exercise: "squat",
    analysis_status: "completed",
    repetitions: 8,
    form_score: null,
    feedback: [
      {
        category: "repetition_analysis",
        message: "Estimated 8 complete repetitions.",
        severity: "info",
      },
    ],
    safety_warnings: [],
    frames_analyzed: 120,
    summary: "Video pose analysis completed.",
  };

  let fetchCalled = false;

  global.fetch = async (url, options) => {
    fetchCalled = true;

    assert.equal(
      url,
      "http://127.0.0.1:8001/form/analyze-video"
    );
    assert.equal(options.method, "POST");
    assert.equal(
      options.headers["X-AI-Service-Token"],
      "test-ai-service-token"
    );
    assert.ok(options.body instanceof FormData);

    const uploadedVideo = options.body.get("video");
    assert.ok(uploadedVideo instanceof Blob);
    assert.equal(uploadedVideo.type, "video/mp4");

    return new Response(JSON.stringify(expectedAnalysis), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/form-analysis/analyze-video",
      ...multipartVideo(),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalled, true);
    assert.equal(response.json().message, "Exercise video analyzed.");
    assert.deepEqual(response.json().analysis, expectedAnalysis);
  } finally {
    global.fetch = originalFetch;
  }
});

test("form analysis safely maps upstream validation errors", async () => {
  process.env.AI_SERVICE_TOKEN = "test-ai-service-token";
  process.env.AI_SERVICE_URL = "http://127.0.0.1:8001";

  global.fetch = async () =>
    new Response(
      JSON.stringify({ detail: "Video contains no usable frames." }),
      {
        status: 422,
        headers: { "content-type": "application/json" },
      }
    );

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/form-analysis/analyze-video",
      ...multipartVideo(),
    });

    assert.equal(response.statusCode, 422);
    assert.equal(
      response.json().error,
      "Video contains no usable frames."
    );
  } finally {
    global.fetch = originalFetch;
  }
});

after(async () => {
  global.fetch = originalFetch;

  if (originalToken === undefined) {
    delete process.env.AI_SERVICE_TOKEN;
  } else {
    process.env.AI_SERVICE_TOKEN = originalToken;
  }

  if (originalServiceUrl === undefined) {
    delete process.env.AI_SERVICE_URL;
  } else {
    process.env.AI_SERVICE_URL = originalServiceUrl;
  }

  await app.close();
});
