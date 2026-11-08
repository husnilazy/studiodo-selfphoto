import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { currentUser, hasUsers } from "@/lib/auth";
import { LoginForm, SetupForm } from "@/components/clientForms";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const setup = !(await hasUsers());
  const users = setup ? [] : await q<{ id: number; name: string }>("select id, name from users where active order by id");
  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="rise w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo height={22} />
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[.2em] text-muted">Hub</p>
        </div>
        <div className="card p-7">
          <h1 className="font-display text-lg">{setup ? "Selamat datang" : "Masuk"}</h1>
          <p className="mb-5 mt-1 text-[13px] text-muted">{setup ? "Buat akun Owner. Empat perusahaan Frameless langsung disiapkan." : "Pusat keuangan & keputusan grup."}</p>
          {setup ? <SetupForm /> : <LoginForm users={users} />}
        </div>
      </div>
    </main>
  );
}
