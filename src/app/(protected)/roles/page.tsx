import { listRoles } from "@/lib/role-store";
import { RolesClient, type RoleRow } from "./roles-client";

export default async function RolesPage() {
  const roles = (await listRoles()) as unknown as RoleRow[];
  return <RolesClient initialRoles={roles} />;
}