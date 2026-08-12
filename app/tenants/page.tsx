import { TenantSwitcher } from "../../src/components/tenant-switcher";

const tenants = [
  { id: "t1", code: "acme", name: "ACME Corp", status: "active" },
  { id: "t2", code: "globex", name: "Globex", status: "active" },
];

export default function TenantListPage() {
  return (
    <div style={{ padding: 24 }}>
      <TenantSwitcher />
      <h1>租户管理（M00.F01）</h1>
      <button data-fn="M00.F01.I02" style={{ marginBottom: 12 }}>
        + 新建租户
      </button>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Code</th>
            <th>名称</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} data-testid="tenant-row">
              <td>{t.code}</td>
              <td>{t.name}</td>
              <td>{t.status}</td>
              <td>
                <button data-fn="M00.F01.I04">编辑</button>
                <button data-fn="M00.F01.I05" style={{ marginLeft: 8 }}>
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