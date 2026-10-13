import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Unit tests live beside the code. The browser tests in e2e/ belong to Playwright.
    include: ["src/**/*.test.ts"],
  },
});
