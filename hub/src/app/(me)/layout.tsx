import MeShell from "@/components/MeShell";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <MeShell user={{ name: user.name, role: user.role }}>{children}</MeShell>;
}
