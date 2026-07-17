import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** M06.F08.I01 平台基础配置页（platform.name / platform.version 只读展示） */
export default function PlatformSettingsPage() {
  return (
    <div
      data-testid="settings-page"
      data-fn="M06.F08.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader><CardTitle>平台基础配置</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">平台名：</span>
            <span className="font-mono">SaaS 统一身份管理</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">版本：</span>
            <span className="font-mono">1.0.0</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
