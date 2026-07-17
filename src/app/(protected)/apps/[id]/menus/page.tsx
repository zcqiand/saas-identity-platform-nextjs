import { notFound } from "next/navigation";
import { getApp } from "@/lib/app-store";
import { getMenuTree } from "@/lib/menu-store";
import { MenusClient, type MenuRow } from "./menus-client";

export default async function MenusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId) || appId <= 0) notFound();
  const app = getApp(appId);
  if (!app) notFound();
  const tree = getMenuTree(appId) as unknown as MenuRow[];
  return <MenusClient appId={appId} appName={app.name} initialMenus={tree} />;
}