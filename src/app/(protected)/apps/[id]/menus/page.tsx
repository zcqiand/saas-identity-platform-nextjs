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
  if (!id) notFound();
  const app = await getApp(id);
  if (!app) notFound();
  const tree = (await getMenuTree(id)) as unknown as MenuRow[];
  return <MenusClient appId={id} appName={app.name} initialMenus={tree} />;
}