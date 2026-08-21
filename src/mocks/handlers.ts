// MSW handlers - re-exported from @saas/identity-platform-msw.
// handlers 走 "./handlers" 子路径：包根入口已不再 re-export handlers
// （拖进 msw 依赖链，Docker sibling clone 无 node_modules 时 build 失败）。
import { handlers as sharedHandlers } from "@saas/identity-platform-msw/handlers";
import { fixtures } from "@saas/identity-platform-msw";
export const handlers = sharedHandlers;
export { fixtures };
export default handlers;
