// StatusBadge — semantic color for tenant/user/api-key/audit status.
import { Badge } from "@/components/ui/badge";

type Status = "active" | "suspended" | "archived" | "invited" | "disabled" | "revoked" | "expired";

const VARIANT: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  invited: "outline",
  suspended: "secondary",
  disabled: "secondary",
  archived: "secondary",
  revoked: "destructive",
  expired: "destructive",
};

const LABEL_ZH: Record<Status, string> = {
  active: "活跃",
  invited: "已邀请",
  suspended: "已暂停",
  disabled: "已禁用",
  archived: "已归档",
  revoked: "已吊销",
  expired: "已过期",
};

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={VARIANT[status]} className="font-normal">
      {LABEL_ZH[status]}
    </Badge>
  );
}