// Trigger shared codegen (emit:openapi only) then run local orval to generate
// src/api/endpoints/{endpoints.ts,endpoints.schemas.ts} from the resulting OpenAPI.yaml.
//
// Architecture: shared 仓 is now a pure contract source (TypeSpec → OpenAPI.yaml).
// Language-specific clients are generated per consuming project (nextjs 仓用 react-query client).
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const root = resolve(import.meta.dirname, "..");
const sharedDir = resolve(root, "../saas-identity-platform-shared");
const openapi = resolve(sharedDir, "generated/openapi/openapi.yaml");
const outDir = resolve(root, "src/api/endpoints");

console.log("[gen-shared] step 1/2 — shared: emit OpenAPI.yaml...");
execSync("npm run emit:openapi", { cwd: sharedDir, stdio: "inherit" });

if (!existsSync(openapi)) {
  throw new Error(`[gen-shared] missing openapi.yaml at ${openapi}`);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

console.log("[gen-shared] step 2/2 — nextjs: orval → src/api/endpoints/...");
execSync("npx orval", { cwd: root, stdio: "inherit" });

console.log("[gen-shared] OK");