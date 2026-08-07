import { getDepartmentTree } from "@/lib/department-store";
import { DepartmentsClient, type DepartmentNode } from "./departments-client";

/**
 * M02.F01 部门管理 — server entry
 *
 * v0.3.0 重命名（原 OrgsPage → DepartmentsPage，路由 /orgs → /departments）。
 */
export default async function DepartmentsPage() {
  const tree = (await getDepartmentTree()) as unknown as DepartmentNode[];
  return <DepartmentsClient initialTree={tree} />;
}