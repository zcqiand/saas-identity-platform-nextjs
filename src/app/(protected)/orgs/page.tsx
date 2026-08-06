import { getOrgTree } from "@/lib/org-store";
import { OrgsClient, type OrgNode } from "./orgs-client";

export default async function OrgsPage() {
  const tree = (await getOrgTree()) as unknown as OrgNode[];
  return <OrgsClient initialTree={tree} />;
}