import type { Metadata } from "next";
import { Providers } from "../src/components/providers";
import { RequireAuth } from "../src/components/require-auth";
import "../src/app/globals.css";

export const metadata: Metadata = {
  title: "SaaS Identity Platform",
  description: "Multi-tenant identity management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <RequireAuth>{children}</RequireAuth>
        </Providers>
      </body>
    </html>
  );
}
