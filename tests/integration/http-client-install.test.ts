// installHttpClient 幂等回归（2026-09-14）：
// 此前 providers.tsx 在 tenant.accessToken 变化时反复 install，而 install 只叠加
// axios 拦截器不 eject —— 请求拦截器链尾的旧闭包会用过期 token 把 Authorization
// 头重新覆盖，重新登录的新 token 永远不生效（authorize 401 指纹：
// "saas session or Bearer token required"，仅当首帧 token 过期后复现）。
// 锁两点：重复 install 拦截器数量不增长；后装 getToken 覆盖先装的取值。
import { describe, it, expect, beforeEach } from "vitest";
import axios from "axios";
import { installHttpClient } from "@/api/http-client";
import { getApiBaseUrl } from "@/api/backend-config";

function requestInterceptorCount(): number {
  // axios InterceptorManager 暴露内部 handlers 数组（vitest 环境无类型，运行时存在）
  return (axios.interceptors.request as unknown as { handlers: unknown[] }).handlers.filter(Boolean)
    .length;
}

/** 非空请求拦截器（axios eject 置 null 不压缩，取剩余 handler 数组） */
function requestHandlers(): Array<{ fulfilled: (c: never) => Promise<unknown> }> {
  return (
    axios.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (c: never) => Promise<unknown> } | null>;
    }
  ).handlers.filter(Boolean) as Array<{ fulfilled: (c: never) => Promise<unknown> }>;
}

describe("installHttpClient 幂等", () => {
  beforeEach(() => {
    // 清空其他测试/先前 install 残留的拦截器，保证计数从已知状态开始
    (axios.interceptors.request as unknown as { handlers: unknown[] }).handlers = [];
    (axios.interceptors.response as unknown as { handlers: unknown[] }).handlers = [];
  });

  it("重复 install 不叠加拦截器（先 eject 再装）", () => {
    installHttpClient(() => "token-a");
    expect(requestInterceptorCount()).toBe(1);
    installHttpClient(() => "token-b");
    expect(requestInterceptorCount()).toBe(1);
    installHttpClient(() => "token-c");
    expect(requestInterceptorCount()).toBe(1);
  });

  it("最新 install 的 getToken 生效（链上只有一个取值来源）", async () => {
    installHttpClient(() => "stale-token");
    installHttpClient(() => "fresh-token");
    // axios eject 只把 handler 槽位置 null 不压缩数组，取最后一个非空（链尾收尾者）
    const handlers = requestHandlers();
    const last = handlers[handlers.length - 1]!;
    const config = (await last.fulfilled({
      headers: new axios.AxiosHeaders(),
    } as never)) as { headers: { get(name: string): string } };
    expect(config.headers.get("Authorization")).toBe("Bearer fresh-token");
  });
});

// -- baseURL 覆盖语义（2026-09-23 登录表单打 :5100 死端口根因）--------------------
//
// 登录页 login/page.tsx 的 idpAxios = { axios: { baseURL: window.location.origin } }
// 把登录 + oauth/authorize 钉死同源（IdP 流程必须打到 IdP 自己的后端，页内注释
// 声明「拦截器只在 config.baseURL 为空时才覆盖」）。但拦截器曾写
// config.baseURL = getApiBaseUrl() 无条件覆盖 —— per-request 同源 baseURL 被
// 盖成本机切换器/env 值（本机 .env.local 残留 :5100，msw 仓已删 → 预检
// ERR_CONNECTION_REFUSED，全新浏览器登录表单静默无反应）。
// 锁两点：显式 baseURL（含 "" 同源）原样保留；未设置时回填 getApiBaseUrl()。
describe("installHttpClient baseURL 覆盖语义", () => {
  beforeEach(() => {
    (axios.interceptors.request as unknown as { handlers: unknown[] }).handlers = [];
    (axios.interceptors.response as unknown as { handlers: unknown[] }).handlers = [];
    installHttpClient(() => "token-x");
  });

  async function runInterceptor(config: object): Promise<{ baseURL?: string }> {
    const handlers = requestHandlers();
    const last = handlers[handlers.length - 1]!;
    return (await last.fulfilled({ headers: new axios.AxiosHeaders(), ...config } as never)) as {
      baseURL?: string;
    };
  }

  it("显式 per-request baseURL 原样保留（登录页 IdP 同源钉死不被盖写）", async () => {
    const config = await runInterceptor({ baseURL: "http://localhost:5101" });
    expect(config.baseURL).toBe("http://localhost:5101");
  });

  it("显式空串 baseURL 保留（「空」= 未设置，不是同源显式值）", async () => {
    const config = await runInterceptor({ baseURL: "" });
    expect(config.baseURL).toBe("");
  });

  it("未设置 baseURL 时回填 getApiBaseUrl()（既有调用方行为不变）", async () => {
    const config = await runInterceptor({});
    expect(config.baseURL).toBe(getApiBaseUrl());
  });
});
