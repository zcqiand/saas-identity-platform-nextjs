// installHttpClient 幂等回归（2026-09-14）：
// 此前 providers.tsx 在 tenant.accessToken 变化时反复 install，而 install 只叠加
// axios 拦截器不 eject —— 请求拦截器链尾的旧闭包会用过期 token 把 Authorization
// 头重新覆盖，重新登录的新 token 永远不生效（authorize 401 指纹：
// "saas session or Bearer token required"，仅当首帧 token 过期后复现）。
// 锁两点：重复 install 拦截器数量不增长；后装 getToken 覆盖先装的取值。
import { describe, it, expect, beforeEach } from "vitest";
import axios from "axios";
import { installHttpClient } from "@/api/http-client";

function requestInterceptorCount(): number {
  // axios InterceptorManager 暴露内部 handlers 数组（vitest 环境无类型，运行时存在）
  return (axios.interceptors.request as unknown as { handlers: unknown[] }).handlers.filter(
    Boolean,
  ).length;
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
    const handlers = (axios.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (c: never) => Promise<unknown> } | null>;
    }).handlers.filter(Boolean)!;
    const last = handlers[handlers.length - 1]!;
    const config = (await last.fulfilled({
      headers: new axios.AxiosHeaders(),
    } as never)) as { headers: { get(name: string): string } };
    expect(config.headers.get("Authorization")).toBe("Bearer fresh-token");
  });
});
