import type { Metadata } from "next";
import { Providers } from "../components/providers";
import { RequireAuth } from "../components/require-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS Identity Platform",
  description: "Multi-tenant identity management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased" data-fn="M04.F04.I08">
        <Providers>
          <RequireAuth>{children}</RequireAuth>
        </Providers>
      </body>
    </html>
  );
}
