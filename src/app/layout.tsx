import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";

/**
 * SaaS 统一身份管理（Next.js）— App Router root layout
 *
 * 全部页面走 (protected) 路由组：访问控制由 src/app/(protected)/layout.tsx 处理。
 * 这里只负责 html/body 骨架 + 全局 sonner toast 容器。
 */
export const metadata: Metadata = {
  title: "SaaS IAM",
  description: "SaaS 统一身份管理 · 控制台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}