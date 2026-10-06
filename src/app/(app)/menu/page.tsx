import Link from "next/link";
import Icon from "@/components/Icon";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import MenuActions from "./MenuActions";

export const metadata = { title: "Menu" };

export default async function MenuPage() {
  const user = await requireUser();
  const items = NAV.filter((n) => n.roles.includes(user.role) && !["/dashboard", "/booking", "/customer"].includes(n.href));
  return (
    <>
      <PageHeader title="Menu" subtitle={`Masuk sebagai ${user.name}`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((n) => (
          <Link key={n.href} href={n.href} className="card anim-rise flex flex-col gap-3 p-4 transition active:scale-95">
            <span className="grid size-11 place-items-center rounded-2xl bg-accentsoft text-accent"><Icon name={n.icon} /></span>
            <span className="font-semibold">{n.label}</span>
          </Link>
        ))}
      </div>
      <MenuActions />
    </>
  );
}
