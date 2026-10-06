"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PinPad from "@/components/PinPad";
import { loginAction } from "@/app/actions/auth";
import { ROLE_LABEL } from "@/lib/format";

type U = { id: number; name: string; role: string };

export default function LoginClient({ users }: { users: U[] }) {
  const [sel, setSel] = useState<U | null>(users.length === 1 ? users[0] : null);
  const router = useRouter();

  if (!sel) {
    return (
      <div className="anim-rise">
        <p className="mb-4 text-center text-sm text-muted">Pilih akun Anda</p>
        <div className="grid grid-cols-2 gap-3">
          {users.map((u) => (
            <button key={u.id} onClick={() => setSel(u)}
              className="card flex flex-col items-center gap-2 p-4 transition active:scale-95 hover:border-accent">
              <span className="font-display grid size-14 place-items-center rounded-full bg-accent text-xl font-semibold text-accentfg">
                {u.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-full truncate font-semibold">{u.name}</span>
              <span className="badge badge-indigo">{ROLE_LABEL[u.role]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-rise">
      <div className="mb-6 flex flex-col items-center gap-1">
        <span className="font-display grid size-14 place-items-center rounded-full bg-accent text-xl font-semibold text-accentfg">
          {sel.name.slice(0, 1).toUpperCase()}
        </span>
        <p className="font-semibold">{sel.name}</p>
        <p className="text-sm text-muted">Masukkan PIN 6 digit</p>
      </div>
      <PinPad
        onComplete={async (pin) => {
          const r = await loginAction(sel.id, pin);
          if (r.ok) { router.replace("/dashboard"); router.refresh(); return null; }
          return r.error;
        }}
      />
      {users.length > 1 && (
        <button onClick={() => setSel(null)} className="mx-auto mt-6 block text-sm font-semibold text-muted hover:text-fg">
          Ganti akun
        </button>
      )}
    </div>
  );
}
