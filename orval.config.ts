import { defineConfig } from "orval";

// orval config (in nextjs 仓) — generates TS api-client from shared's OpenAPI.yaml.
//
// Source contract lives in shared 仓 at ../saas-identity-platform-shared/generated/openapi/openapi.yaml.
// This file is owned by nextjs 仓; other frontends (react / vue / kotlin-android) have their own copy.
// NOTE: nextjs 仓用 client: "react-query"（与 react 仓同构；vue 仓用 vue-query）。
export default defineConfig({
  saas: {
    input: "../saas-identity-platform-shared/generated/openapi/openapi.yaml",
    output: {
      mode: "split",
      target: "./src/api/endpoints/endpoints.ts",
      client: "react-query",
      override: {
        useDates: false,
        query: {
          useQuery: true,
          useInfinite: false,
          useSuspenseQuery: false,
          signal: true,
        },
      },
    },
  },
});