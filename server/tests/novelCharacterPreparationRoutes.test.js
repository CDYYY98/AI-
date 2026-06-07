const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { z } = require("zod");

const { registerNovelCharacterPreparationRoutes } = require("../dist/routes/novelCharacterPreparationRoutes.js");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(address.port);
    });
  });
}

function closeServer(server) {
  server.closeAllConnections?.();
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function postJson(port, path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Connection: "close",
        },
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode,
              json: raw ? JSON.parse(raw) : null,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.end(body);
  });
}

test("character cast apply route runs post-apply enhancements in background mode", async () => {
  let capturedApplyArgs = null;
  const router = express.Router();
  registerNovelCharacterPreparationRoutes({
    router,
    idParamsSchema: z.object({ id: z.string().trim().min(1) }),
    novelService: {
      applyCharacterCastOption: async (...args) => {
        capturedApplyArgs = args;
        return {
          optionId: args[1],
          createdCount: 2,
          updatedCount: 0,
          relationCount: 1,
          characterIds: ["char_1", "char_2"],
          primaryCharacterId: "char_1",
          qualityOverrideApplied: false,
          qualityWarnings: [],
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use("/api/novels", router);
  const server = http.createServer(app);
  const port = await listen(server);

  try {
    const response = await postJson(
      port,
      "/api/novels/novel_cast/character-prep/cast-options/option_1/apply",
      {
        provider: "deepseek",
        model: "deepseek-chat",
        temperature: 0.45,
      },
    );

    assert.equal(response.status, 200);
    assert.equal(response.json.data.optionId, "option_1");
    assert.equal(capturedApplyArgs?.[0], "novel_cast");
    assert.equal(capturedApplyArgs?.[1], "option_1");
    assert.deepEqual(capturedApplyArgs?.[2], {
      overrideQualityGate: undefined,
      postApplyMode: "background",
      visibleProfileGeneration: {
        provider: "deepseek",
        model: "deepseek-chat",
        temperature: 0.45,
      },
    });
  } finally {
    await closeServer(server);
  }
});
