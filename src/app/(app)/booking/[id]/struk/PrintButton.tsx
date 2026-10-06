"use client";
import Icon from "@/components/Icon";

export default function PrintButton() {
  return <button className="btn btn-primary flex-1" onClick={() => window.print()}><Icon name="printer" className="size-4" /> Cetak</button>;
}
