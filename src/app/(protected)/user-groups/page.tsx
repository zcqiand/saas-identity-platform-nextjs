import { listUserGroups } from "@/lib/user-group-store";
import { UserGroupsClient, type GroupRow } from "./user-groups-client";

export default function UserGroupsPage() {
  const groups = listUserGroups() as unknown as GroupRow[];
  return <UserGroupsClient initialGroups={groups} />;
}