import { TenantSwitcher } from "../../../../src/components/tenant-switcher";

const users = [
  { id: "u1", username: "alice", email: "alice@acme.io", status: "active" },
  { id: "u2", username: "bob", email: "bob@acme.io", status: "invited" },
];

export default async function UserListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <div style={{ padding: 24 }}>
      <TenantSwitcher />
      <h1>用户管理（M01.F01）— tenant {tenantId.slice(0, 8)}</h1>
      <button data-fn="M01.F01.I02" style={{ marginBottom: 12 }}>
        + 邀请用户
      </button>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>用户名</th>
            <th>邮箱</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} data-testid="user-row">
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.status}</td>
              <td>
                <button data-fn="M01.F01.I06">分配角色</button>
                <button data-fn="M01.F01.I04" style={{ marginLeft: 8 }}>
                  编辑
                </button>
                <button data-fn="M01.F01.I05" style={{ marginLeft: 8 }}>
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}