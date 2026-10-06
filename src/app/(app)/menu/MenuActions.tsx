"use client";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { logoutAction } from "@/app/actions/auth";

export default function MenuActions() {
  const router = useRouter();
  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      <button className="btn" onClick={() => {
        const el = document.documentElement;
        const dark = el.dataset.theme ? el.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
        el.dataset.theme = dark ? "light" : "dark";
        try { localStorage.setItem("sd_theme", el.dataset.theme); } catch {}
      }}><Icon name="moon" className="size-4" /> Ganti Tema</button>
      <button className="btn btn-danger" onClick={async () => { await logoutAction(); router.replace("/login"); router.refresh(); }}>
        <Icon name="logout" className="size-4" /> Keluar
      </button>
    </div>
  );
}
