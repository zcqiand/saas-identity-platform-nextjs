import { listUserGroups } from "@/lib/user-group-store";
import { UserGroupsClient, type GroupRow } from "./user-groups-client";

export default async function UserGroupsPage() {
  const groups = (await listUserGroups()) as unknown as GroupRow[];
  return <UserGroupsClient initialGroups={groups} />;
}