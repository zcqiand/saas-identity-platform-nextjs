// MSW browser worker setup for Next.js dev mode.
import { setupBrowserMocks } from "@saas/identity-platform-msw/browser";

export async function enableMocking() {
  if (process.env.NODE_ENV === "production") return;
  await setupBrowserMocks();
}