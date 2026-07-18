// @entry M03.F02.I01 权限组列表页
// @entry M03.F02.I02 新建权限组
// @entry M03.F02.I03 编辑权限组
// @entry M03.F02.I04 删除权限组
// @entry M03.F02.I05 权限组 store 内部接口（src/lib/permission-group-store.ts）

import { listPermissionGroups } from "@/lib/permission-group-store";
import {
  PermissionGroupsClient,
  type PermGroupRow,
} from "./permission-groups-client";

export default function PermissionGroupsPage() {
  const groups = listPermissionGroups() as unknown as PermGroupRow[];
  return <PermissionGroupsClient initialGroups={groups} />;
}