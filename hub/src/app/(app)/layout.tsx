import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { currentUser, isTeam } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Semua query sekaligus (paralel): lebih cepat daripada berurutan.
  const [user, companies, cash] = await Promise.all([
    currentUser(),
    q<{ slug: string; name: string }>("select slug, name from companies where active order by sort, id"),
    q<{ c: number }>(`select coalesce(sum(case
        when kind in ('revenue','capital_in') then amount
        when kind = 'withdrawal' then -amount
        when kind in ('expense','asset_purchase') and funding = 'company' then -amount
        else 0 end), 0)::bigint as c from transactions`),
  ]);
  if (!user) redirect("/login");
  if (!isTeam(user)) redirect("/saya"); // investor & karyawan punya area sendiri
  return <Shell user={{ name: user.name, role: user.role }} companies={companies} cash={Number(cash[0]?.c) || 0}>{children}</Shell>;
}
