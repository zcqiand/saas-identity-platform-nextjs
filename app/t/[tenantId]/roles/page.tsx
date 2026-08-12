import { TenantSwitcher } from "../../../../src/components/tenant-switcher";

const roles = [
  { id: "r1", code: "admin", name: "管理员" },
  { id: "r2", code: "member", name: "普通成员" },
];

export default async function RoleListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <div style={{ padding: 24 }}>
      <TenantSwitcher />
      <h1>角色权限（M02.F01）— tenant {tenantId.slice(0, 8)}</h1>
      <button data-fn="M02.F01.I02" style={{ marginBottom: 12 }}>
        + 新建角色
      </button>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Code</th>
            <th>名称</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.code}</td>
              <td>{r.name}</td>
              <td>
                <button data-fn="M02.F02.I01">权限矩阵</button>
                <button data-fn="M02.F01.I04" style={{ marginLeft: 8 }}>
                  编辑
                </button>
                <button data-fn="M02.F01.I05" style={{ marginLeft: 8 }}>
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