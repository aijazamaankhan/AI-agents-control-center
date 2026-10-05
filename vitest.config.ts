import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `server-only` throws outside the React server bundler; tests import server modules directly.
const serverOnlyStub = fileURLToPath(
  new URL("./tests/support/server-only-stub.ts", import.meta.url),
);

export default defineConfig({
  resolve: { tsconfigPaths: true, alias: { "server-only": serverOnlyStub } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/support/integration-global-setup.ts"],
          env: {
            NODE_ENV: "test",
            DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
            // Test-only key (32 zero-ish bytes); never used outside tests.
            ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
          },
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
