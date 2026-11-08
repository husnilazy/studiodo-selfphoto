import Shell from "@/components/Shell";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [companies, cash] = await Promise.all([
    q<{ slug: string; name: string }>("select slug, name from companies where active order by sort, id"),
    q<{ c: number }>(`select coalesce(sum(case
        when kind in ('revenue','capital_in') then amount
        when kind = 'withdrawal' then -amount
        when kind in ('expense','asset_purchase') and funding = 'company' then -amount
        else 0 end), 0)::bigint as c from transactions`),
  ]);
  return <Shell user={{ name: user.name, role: user.role }} companies={companies} cash={Number(cash[0]?.c) || 0}>{children}</Shell>;
}
