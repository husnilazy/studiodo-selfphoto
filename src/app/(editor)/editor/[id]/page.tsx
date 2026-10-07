import { notFound } from "next/navigation";
import EditorApp from "@/components/editor/EditorApp";
import type { AssetRow, FrameRow } from "@/components/editor/LeftPanel";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { getStudio } from "@/lib/data";
import { getOnline } from "@/lib/online";
import { getSiteConfig } from "@/lib/siteServer";
import { imageSrc } from "@/lib/siteConfig";
import type { Brand } from "@/lib/editor/templates";
import { newBg, newPage, sizeById, type Design, type DesignKind } from "@/lib/editor/types";
import { storageReady } from "@/lib/siteServer";

export const metadata = { title: "Editor Foto" };

const START: Record<string, { kind: DesignKind; size: string; name: string }> = {
  feed: { kind: "feed", size: "feed45", name: "Postingan feed" },
  carousel: { kind: "carousel", size: "feed45", name: "Carousel" },
  story: { kind: "story", size: "story", name: "Story" },
  print: { kind: "print", size: "4r", name: "Cetak 4R" },
  frame: { kind: "frame", size: "4r", name: "Foto frame" },
};

export default async function EditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string; frame?: string; customer?: string }> }) {
  const user = await requireUser();
  const { id: rawId } = await params;
  const sp = await searchParams;
  const designId = rawId === "baru" ? null : Number(rawId);
  if (designId !== null && !Number.isInteger(designId)) notFound();

  const [studio, site, online, assets] = await Promise.all([
    getStudio(), getSiteConfig(), getOnline(),
    q<AssetRow>("select id, name, url, w, h from design_assets order by created_at desc limit 120"),
  ]);
  const b = site.brand;
  const brand: Brand = {
    name: studio.name, logo: b.logo_url ? imageSrc(b.logo_url) : "", logoDark: b.logo_dark_url ? imageSrc(b.logo_dark_url) : "",
    accent: b.accent, accent2: b.accent2, instagram: online.instagram, whatsapp: online.whatsapp, address: studio.address,
  };

  const [frames, existing] = await Promise.all([
    q<FrameRow>("select id, name, category, url, w, h, slots from frames where active order by created_at desc"),
    designId ? q<{ name: string; kind: DesignKind; data: Design; customer_id: number | null }>("select name, kind, data, customer_id from designs where id = $1", [designId]) : Promise.resolve([]),
  ]);
  if (designId && !existing[0]) notFound();

  let initial: Design;
  let customerId = Number(sp.customer) || existing[0]?.customer_id || null;
  if (existing[0]) {
    initial = { name: existing[0].name, kind: existing[0].kind, pages: existing[0].data.pages };
  } else {
    const st = START[sp.kind ?? ""] ?? START.feed;
    const sz = sizeById(st.size)!;
    initial = { name: st.name, kind: st.kind, pages: [newPage(sz.w, sz.h, newBg("#ffffff"))] };
  }
  const customer = customerId ? (await q<{ id: number; name: string }>("select id, name from customers where id = $1", [customerId]))[0] ?? null : null;
  if (!customer) customerId = null;

  return (
    <EditorApp initial={initial} designId={designId} storage={storageReady()} canManageFrames={user.role !== "kasir"} customer={customer}
      frames={frames.map((f) => ({ ...f, slots: f.slots ?? [] }))} startFrame={Number(sp.frame) || null} brand={brand} assets={assets} />
  );
}
