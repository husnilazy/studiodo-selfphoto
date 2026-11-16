"use client";
import { useState } from "react";
import Icon from "./Icon";
import { toast } from "./Toaster";

/** Mengunduh semua tabel di dalam #report sebagai CSV (dibuka mulus di Excel / Google Sheets). */
export default function ExportCsv({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn btn-sm" disabled={busy} onClick={() => {
      setBusy(true);
      const out: string[] = [];
      document.querySelectorAll("#report table").forEach((t) => {
        t.querySelectorAll("tr").forEach((tr) => {
          const cells = [...tr.children].map((c) => `"${(c as HTMLElement).innerText.replace(/\s+/g, " ").trim().replace(/"/g, '""')}"`);
          out.push(cells.join(";"));
        });
        out.push("");
      });
      const blob = new Blob(["﻿" + out.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast(`${name}.csv diunduh`);
      setTimeout(() => setBusy(false), 700);
    }}>
      {busy ? <span className="spinner" /> : <Icon name="download" className="size-4" />} {busy ? "Menyiapkan…" : "CSV"}
    </button>
  );
}

export function PrintBtn() {
  return <button className="btn btn-sm" onClick={() => window.print()}><Icon name="printer" className="size-4" /> Cetak / PDF</button>;
}
