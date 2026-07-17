import { getOrgTree } from "@/lib/org-store";
import { OrgsClient, type OrgNode } from "./orgs-client";

export default function OrgsPage() {
  const tree = getOrgTree() as unknown as OrgNode[];
  return <OrgsClient initialTree={tree} />;
}