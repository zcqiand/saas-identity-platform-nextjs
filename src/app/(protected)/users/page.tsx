import { listUsers } from "@/lib/user-store";
import { UsersClient, type UserRow } from "./users-client";

export default async function UsersPage() {
  const users = (await listUsers()) as unknown as UserRow[];
  return <UsersClient initialUsers={users} />;
}