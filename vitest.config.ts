import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "api",
          environment: "node",
          include: ["tests/api-*.test.ts"],
        },
      },
      {
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/api-*.test.ts"],
        },
      },
    ],
  },
});
