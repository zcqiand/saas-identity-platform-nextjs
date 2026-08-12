import type { Metadata } from "next";
import { Providers } from "../src/components/providers";

export const metadata: Metadata = {
  title: "SaaS Identity Platform",
  description: "Multi-tenant identity management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}