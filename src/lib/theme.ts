/**
 * M01.F02 租户主题 — 应用 / 清除主题 CSS 变量
 *
 * 输入 theme name（"default" / "dark" / "light"），输出 :root CSS 字符串。
 * 服务端 (protected)/layout.tsx 把它塞进 <style> 注入到 <head>。
 */
export function applyTheme(theme: string): string {
  const tokens = themeTokens(theme);
  return `:root{${tokens}}`;
}

export function clearTheme(): string {
  return ":root{}";
}

function themeTokens(theme: string): string {
  switch (theme) {
    case "dark":
      return [
        "--background:#0a0a0a",
        "--foreground:#ededed",
        "--primary:#3b82f6",
        "--border:#262626",
      ].join(";");
    case "light":
      return [
        "--background:#ffffff",
        "--foreground:#171717",
        "--primary:#2563eb",
        "--border:#e5e5e5",
      ].join(";");
    case "default":
    default:
      return [
        "--background:#fafafa",
        "--foreground:#171717",
        "--primary:#0070f3",
        "--border:#eaeaea",
      ].join(";");
  }
}