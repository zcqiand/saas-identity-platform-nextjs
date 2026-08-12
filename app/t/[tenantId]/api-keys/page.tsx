import { TenantSwitcher } from "../../../../src/components/tenant-switcher";

const keys = [{ id: "k1", name: "Prod Key", prefix: "sk_live", status: "active" }];

export default async function ApiKeyListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <div style={{ padding: 24 }}>
      <TenantSwitcher />
      <h1>API Key（M05.F01）— tenant {tenantId.slice(0, 8)}</h1>
      <button data-fn="M05.F01.I02" style={{ marginBottom: 12 }}>
        + 创建 Key
      </button>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>名称</th>
            <th>前缀</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id}>
              <td>{k.name}</td>
              <td>{k.prefix}</td>
              <td>{k.status}</td>
              <td>
                <button data-fn="M05.F01.I04">轮换</button>
                <button data-fn="M05.F01.I03" style={{ marginLeft: 8 }}>
                  吊销
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}