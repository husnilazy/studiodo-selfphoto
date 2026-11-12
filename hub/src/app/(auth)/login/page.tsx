import { redirect } from "next/navigation";
import { currentUser, hasUsers, lockedUser } from "@/lib/auth";
import { LoginForm, SetupForm, UnlockForm } from "@/components/clientForms";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const locked = await lockedUser();
  const setup = !locked && !(await hasUsers());
  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="rise w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo height={22} />
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[.2em] text-muted">Hub</p>
        </div>
        <div className="card p-7">
          <h1 className="font-display text-lg">{locked ? "Layar terkunci" : setup ? "Selamat datang" : "Masuk"}</h1>
          <p className="mb-5 mt-1 text-[13px] text-muted">{locked ? "Data disembunyikan sampai PIN dimasukkan." : setup ? "Buat akun Owner. Empat perusahaan Frameless langsung disiapkan." : "Pusat keuangan & keputusan grup."}</p>
          {locked ? <UnlockForm name={locked.name} /> : setup ? <SetupForm /> : <LoginForm />}
        </div>
        {locked && (
          <form action="/api/logout" method="post" className="mt-4 text-center">
            <button className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">Bukan {locked.name}? Masuk dengan akun lain</button>
          </form>
        )}
      </div>
    </main>
  );
}
