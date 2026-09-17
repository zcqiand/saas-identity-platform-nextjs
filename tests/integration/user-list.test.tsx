// M01.F01 — tenant-scoped 用户列表
// 页面对齐 roles 页先例：import 直连真源 tag 模块（tenant-members / tenant-roles），
// 禁止回流 endpoints.ts legacy 死桩（死桩恒返空数组 = 列表页恒空白，浏览器可见而单测不可见）。
// 本测试 mock 真源模块供数据、legacy 死桩显式清空 —— 页面若还挂死桩，此处必红。
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import UserListPage from "../../src/app/tenants/[tenantId]/members/page";

const USERS = [
  { id: "u1", tenantId: "t1", username: "alice", email: "alice@acme.io", status: "active", roleIds: ["r1"] },
  { id: "u2", tenantId: "t1", username: "bob", email: "bob@acme.io", status: "active", roleIds: ["r2"] },
  { id: "u3", tenantId: "t1", username: "carol", email: "carol@acme.io", status: "invited", roleIds: [] },
];
const ROLES = [
  { id: "r1", code: "admin", name: "租户管理员" },
  { id: "r2", code: "member", name: "成员" },
];

function queryResult(data: unknown) {
  return {
    data,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
}
function mutStub() {
  return {
    mutate: () => {},
    mutateAsync: async () => ({ data: {} }),
    isPending: false,
    reset: () => {},
  };
}

vi.mock("@/api/endpoints/tenant-members/tenant-members", () => ({
  useTenantMembersListTenantUsers: () => queryResult({ data: { items: USERS } }),
  useTenantMembersCreateTenantUser: () => mutStub(),
  useTenantMembersUpdateTenantUser: () => mutStub(),
  useTenantMembersDeleteTenantUser: () => mutStub(),
  useTenantMembersAssignTenantMemberRoles: () => mutStub(),
}));
vi.mock("@/api/endpoints/tenant-roles/tenant-roles", () => ({
  useTenantRolesListSysRoles: () => queryResult({ data: { items: ROLES } }),
}));
// legacy 死桩清空：页面 import 它 = 回归 = 列表空 = 红
vi.mock("@/api/endpoints", () => ({
  useTenantUsersListUsers: () => queryResult({ data: { items: [] } }),
  useTenantRolesListRoles: () => queryResult({ data: { items: [] } }),
}));

describe("M01.F01 用户管理（tenant-scoped）", () => {
  it("渲染用户列表行（真源接线，死桩禁用）", async () => {
    const params = (await Promise.resolve({ tenantId: "abc" })) as unknown as Parameters<
      typeof UserListPage
    >[0]["params"];
    render(
      <TestProviders>
        <UserListPage params={params} />
      </TestProviders>,
    );
    await screen.findByText("alice");
    expect(screen.getAllByTestId("user-row")).toHaveLength(3);
    expect(screen.getByText("bob")).toBeTruthy();
    expect(screen.getByText("carol")).toBeTruthy();
  });

  it("邀请按钮挂 data-fn=M01.F04.I03", async () => {
    const params = (await Promise.resolve({ tenantId: "abc" })) as unknown as Parameters<
      typeof UserListPage
    >[0]["params"];
    render(
      <TestProviders>
        <UserListPage params={params} />
      </TestProviders>,
    );
    const btn = screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M01.F04.I03");
    expect(btn).toBeTruthy();
  });
});
