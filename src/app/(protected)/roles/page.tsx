import { listRoles } from "@/lib/role-store";
import { RolesClient, type RoleRow } from "./roles-client";

export default function RolesPage() {
  const roles = listRoles() as unknown as RoleRow[];
  return <RolesClient initialRoles={roles} />;
}