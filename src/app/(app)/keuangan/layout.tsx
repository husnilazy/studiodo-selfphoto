import FinanceTabs from "@/components/FinanceTabs";
import { requireUser } from "@/lib/auth";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["owner", "admin"]);
  return (
    <>
      <FinanceTabs role={user.role} />
      {children}
    </>
  );
}
