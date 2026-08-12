// MSW Node interceptor — used by vitest for component tests.
import { setupNodeMocks } from "@saas/identity-platform-msw/node";

export const server = setupNodeMocks();