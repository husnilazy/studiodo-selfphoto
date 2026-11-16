"use client";
import { useState } from "react";
import Icon from "./Icon";
import { toast } from "./Toaster";

export default function CopyLink({ url, label = "Salin link" }: { url: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn btn-sm" onClick={() => {
      navigator.clipboard?.writeText(url).then(() => { setOk(true); toast("Link disalin"); setTimeout(() => setOk(false), 1800); }, () => toast("Gagal menyalin", "bad"));
    }}>
      <Icon name={ok ? "check" : "link"} className="size-4" /> {ok ? "Tersalin" : label}
    </button>
  );
}
