const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
    return true;
  } catch {
    reply.code(401).send({
      error: "Authentication required.",
    });
    return false;
  }
}

async function formAnalysisRoutes(app) {
  app.post(
    "/analyze-video",
    {
      onRequest: authenticate,
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.isMultipart()) {
          return reply.code(400).send({
            error: "An MP4 exercise video is required.",
          });
        }

        const file = await request.file({
          limits: {
            fileSize: MAX_VIDEO_BYTES,
            files: 1,
            fields: 0,
          },
        });

        if (!file) {
          return reply.code(400).send({
            error: "An exercise video is required.",
          });
        }

        if (file.mimetype !== "video/mp4") {
          return reply.code(415).send({
            error: "Only MP4 video files are supported.",
          });
        }

        const videoBuffer = await file.toBuffer();

        if (videoBuffer.length === 0) {
          return reply.code(400).send({
            error: "The uploaded video is empty.",
          });
        }

        if (!process.env.AI_SERVICE_TOKEN) {
          request.log.error("AI_SERVICE_TOKEN is not configured.");
          return reply.code(503).send({
            error: "Exercise analysis is temporarily unavailable.",
          });
        }

        const aiServiceUrl = (
          process.env.AI_SERVICE_URL || "http://127.0.0.1:8001"
        ).replace(/\/+$/, "");

        const form = new FormData();
        form.append(
          "video",
          new Blob([videoBuffer], { type: file.mimetype }),
          "exercise-video.mp4"
        );

        const response = await fetch(
          `${aiServiceUrl}/form/analyze-video`,
          {
            method: "POST",
            headers: {
              "X-AI-Service-Token": process.env.AI_SERVICE_TOKEN,
            },
            body: form,
            signal: AbortSignal.timeout(300000),
          }
        );

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          const upstreamMessage =
            typeof result?.detail === "string"
              ? result.detail
              : typeof result?.error === "string"
                ? result.error
                : "The video could not be analyzed.";

          if ([400, 413, 415, 422].includes(response.status)) {
            return reply.code(response.status).send({
              error: upstreamMessage.slice(0, 500),
            });
          }

          request.log.error(
            { upstreamStatus: response.status },
            "Exercise AI service returned an error."
          );

          return reply
            .code(response.status === 504 ? 504 : 503)
            .send({
              error: "Exercise analysis is temporarily unavailable.",
            });
        }

        if (!result || typeof result !== "object") {
          request.log.error("Exercise AI service returned an invalid response.");
          return reply.code(502).send({
            error: "The exercise analysis service returned an invalid response.",
          });
        }

        return reply.code(200).send({
          message: "Exercise video analyzed.",
          analysis: result,
        });
      } catch (error) {
        if (
          error.code === "FST_REQ_FILE_TOO_LARGE" ||
          error.statusCode === 413
        ) {
          return reply.code(413).send({
            error: "Video exceeds the 50 MB upload limit.",
          });
        }

        if (
          error.name === "TimeoutError" ||
          error.name === "AbortError"
        ) {
          return reply.code(504).send({
            error: "Exercise analysis timed out. Please try again.",
          });
        }

        request.log.error(
          { errorName: error.name, errorCode: error.code },
          "Exercise form analysis request failed."
        );

        return reply.code(503).send({
          error: "Exercise analysis is temporarily unavailable.",
        });
      }
    }
  );
}

module.exports = formAnalysisRoutes;
