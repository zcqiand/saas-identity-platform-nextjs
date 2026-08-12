import { execSync } from "node:child_process";
import { resolve } from "node:path";

const sharedDir = resolve(__dirname, "../../saas-identity-platform-shared");
console.log("[gen-shared] rebuilding shared TypeSpec artifacts...");
execSync("npm run build", { cwd: sharedDir, stdio: "inherit" });
console.log("[gen-shared] OK");