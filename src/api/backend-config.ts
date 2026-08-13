// 运行时后端配置：模块级单例。React context 在 mount 时把 localStorage 里的值
// 同步进来，setBackend/setBaseUrl 写回这里 + localStorage。这样非 React 模块
//（如 http-client / MSW 启动脚本）也能拿到当前模式，不依赖 hook。

export type BackendMode = "msw" | "aspnetcore" | "springboot" | "nextjs-self";

const DEFAULT_BASE_URLS: Readonly<Record<BackendMode, string>> = {
  msw: "", // 同源，service worker 拦截
  aspnetcore: "http://localhost:5000",
  springboot: "http://localhost:8080",
  // v0.4.0 (ADR-0008)：同源；调 app/api/v1/... Route Handler
  // 留空让 orval 客户端走相对路径；http-client 需要特判空字符串
  "nextjs-self": "",
};

let currentBackend: BackendMode = "msw";
let baseUrls: Record<BackendMode, string> = { ...DEFAULT_BASE_URLS };

export function getBackend(): BackendMode {
  return currentBackend;
}

export function setBackend(mode: BackendMode): void {
  currentBackend = mode;
}

export function getBaseUrl(): string {
  return baseUrls[currentBackend];
}

export function getBaseUrlFor(mode: BackendMode): string {
  return baseUrls[mode];
}

export function setBaseUrlFor(mode: BackendMode, url: string): void {
  baseUrls[mode] = url;
}

/** 把 localStorage 里持久化的配置 hydrate 进单例（仅在 BackendProvider mount 时调） */
export function hydrateBackendConfig(persisted: {
  backend?: BackendMode;
  baseUrls?: Partial<Record<BackendMode, string>>;
}): void {
  if (persisted.backend) currentBackend = persisted.backend;
  if (persisted.baseUrls) baseUrls = { ...baseUrls, ...persisted.baseUrls };
}

/** 单例当前完整快照（写 localStorage 时用） */
export function snapshotBackendConfig(): {
  backend: BackendMode;
  baseUrls: Record<BackendMode, string>;
} {
  return { backend: currentBackend, baseUrls: { ...baseUrls } };
}

export const BACKEND_DEFAULT_BASE_URLS = DEFAULT_BASE_URLS;