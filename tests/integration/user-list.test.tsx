// M01.F01 — tenant-scoped 用户列表
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import UserListPage from "../../app/t/[tenantId]/users/page";

describe("M01.F01 用户管理（tenant-scoped）", () => {
  it("渲染用户列表，邀请按钮挂 data-fn=M01.F01.I02", async () => {
    // params 是 Promise<{...}>，mock 的 use() 不解包；测试直接 await 拿出对象
    const params = (await Promise.resolve({ tenantId: "abc" })) as unknown as Parameters<typeof UserListPage>[0]["params"];
    render(
      <TestProviders>
        <UserListPage params={params} />
      </TestProviders>,
    );
    const btn = screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M01.F01.I02");
    expect(btn).toBeTruthy();
  });
});