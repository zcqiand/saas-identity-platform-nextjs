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
      mode: "tags-split",
      target: "./src/api/endpoints/",
      // clean：生成前清空目标目录（2026-09-17 SSOT 清理）——tags-split 不会删除
      // 已从契约移除的 tag 旧目录/旧模型。整个 endpoints/ 目录 must stay orval-owned：
      // 手写 barrel（endpoints.ts / endpoints.schemas.ts）已迁出到 src/api/ 下，不得混回。
      // schema 落在生成物 title.schemas.ts（属 orval 产物，可清可重生成）。
      clean: ["./src/api/endpoints/"],
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