import type { Metadata } from "next";
import { TenantProvider } from "../src/state/tenant-context";

export const metadata: Metadata = {
  title: "SaaS Identity Platform",
  description: "Multi-tenant identity management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <TenantProvider>{children}</TenantProvider>
      </body>
    </html>
  );
}