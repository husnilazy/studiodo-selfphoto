import { redirect } from "next/navigation";
import { hasUsers } from "@/lib/auth";
import SetupClient from "./SetupClient";

export const metadata = { title: "Setup Awal" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasUsers()) redirect("/login");
  return <SetupClient />;
}
