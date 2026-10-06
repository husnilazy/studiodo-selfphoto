import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { currentUser, hasUsers } from "@/lib/auth";
import LoginClient from "./LoginClient";

export const metadata = { title: "Masuk" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await hasUsers())) redirect("/setup");
  if (await currentUser()) redirect("/dashboard");
  const users = await q<{ id: number; name: string; role: string }>(
    "select id, name, role from users where active order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, name");
  return <LoginClient users={users} />;
}
