import { TenantSwitcher } from "../../src/components/tenant-switcher";

const apps = [{ id: "a1", clientId: "demo-client", name: "Demo App" }];

export default function OAuthAppListPage() {
  return (
    <div style={{ padding: 24 }}>
      <TenantSwitcher />
      <h1>OAuth2 应用（M04.F01）</h1>
      <button data-fn="M04.F01.I02" style={{ marginBottom: 12 }}>
        + 注册应用
      </button>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Client ID</th>
            <th>名称</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id}>
              <td>{a.clientId}</td>
              <td>{a.name}</td>
              <td>
                <button data-fn="M04.F01.I04">编辑</button>
                <button data-fn="M04.F01.I05" style={{ marginLeft: 8 }}>
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