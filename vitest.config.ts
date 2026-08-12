import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import FnReporter from "./tests/fnReporter";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src/", import.meta.url).pathname,
    },
  },
  test: {
    globals: false,
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 10000,
    setupFiles: ["./tests/setup.ts"],
    reporters: ["default", new FnReporter() as any],
  },
});