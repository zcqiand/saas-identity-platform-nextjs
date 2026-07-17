import { listUsers } from "@/lib/user-store";
import { UsersClient, type UserRow } from "./users-client";

export default function UsersPage() {
  const users = listUsers() as unknown as UserRow[];
  return <UsersClient initialUsers={users} />;
}