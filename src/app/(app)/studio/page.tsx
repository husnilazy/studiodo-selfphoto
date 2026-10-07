import Link from "next/link";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import { Badge, Empty, PageHeader, Tabs } from "@/components/ui";
import { q } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { storageReady } from "@/lib/siteServer";
import { DesignDetail, ExportActions, FrameEdit, STATUS_LABEL, type ExportRow } from "./DesignForms";
import FrameUploader, { FRAME_CATS } from "./FrameUploader";

export const metadata = { title: "Studio Foto" };

type D = { id: number; name: string; kind: string; thumb_url: string; status: string; caption: string; tags: string; updated_at: string; pages: number; customer: string | null };
type F = { id: number; name: string; category: string; url: string; w: number; h: number; slots: unknown[]; active: boolean };

const KIND: Record<string, string> = { frame: "Frame", feed: "Feed", carousel: "Carousel", story: "Story", print: "Cetak" };
const STATUS_TONE: Record<string, string> = { draf: "slate", siap: "indigo", posted: "green" };
const STARTS = [
  { kind: "feed", t: "Postingan Feed", d: "4:5 · 1080×1350", i: "layout" },
  { kind: "carousel", t: "Carousel", d: "Banyak slide dari beberapa foto", i: "box" },
  { kind: "story", t: "Story / Reels", d: "9:16 · 1080×1920", i: "camera" },
  { kind: "frame", t: "Foto + Frame", d: "Template photobooth", i: "star" },
  { kind: "print", t: "Cetak 4R", d: "10,2×15,2 cm · 300 dpi", i: "printer" },
];

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ tab?: string; st?: string; k?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "frame" ? "frame" : sp.tab === "file" ? "file" : "desain";
  const admin = user.role !== "kasir";
  const storage = storageReady();

  const [designs, frames, exportsAll] = await Promise.all([
    tab === "desain" ? q<D>(
      `select d.id, d.name, d.kind, d.thumb_url, d.status, d.caption, d.tags, d.updated_at, coalesce(jsonb_array_length(d.data->'pages'), 1)::int as pages, c.name as customer
         from designs d left join customers c on c.id = d.customer_id order by d.updated_at desc limit 200`) : Promise.resolve([] as D[]),
    q<F>("select id, name, category, url, w, h, slots, active from frames order by active desc, created_at desc"),
    tab !== "frame" ? q<ExportRow & { design_id: number | null; design_name: string | null }>(
      `select e.id, e.name, e.url, e.w, e.h, e.format, e.size_bytes, e.created_at, e.design_id, d.name as design_name
         from design_exports e left join designs d on d.id = e.design_id order by e.created_at desc limit 300`) : Promise.resolve([]),
  ]);

  const term = (sp.q ?? "").trim().toLowerCase();
  const shown = designs.filter((d) => (!sp.st || d.status === sp.st) && (!sp.k || d.kind === sp.k) && (!term || `${d.name} ${d.customer ?? ""} ${d.caption} ${d.tags}`.toLowerCase().includes(term)));
  const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <>
      <PageHeader title="Studio Foto" subtitle="Edit foto dengan frame photobooth, desain postingan Instagram, dan cetak berbagai ukuran."
        actions={
          <Sheet title="Desain Baru" wide trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Desain Baru</button>}>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {STARTS.map((s) => (
                <Link key={s.kind} href={`/editor/baru?kind=${s.kind}`} className="card hover-lift flex items-center gap-3 p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accentsoft text-accent"><Icon name={s.i} /></span>
                  <span><span className="block font-semibold">{s.t}</span><span className="block text-xs text-muted">{s.d}</span></span>
                </Link>
              ))}
            </div>
            {frames.filter((f) => f.active).length > 0 && (
              <>
                <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-muted">Mulai langsung dari frame</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {frames.filter((f) => f.active).map((f) => (
                    <Link key={f.id} href={`/editor/baru?kind=frame&frame=${f.id}`} className="group overflow-hidden rounded-xl border border-line transition hover:border-accent">
                      <span className="editor-checker block p-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt={f.name} loading="lazy" className="mx-auto h-24 w-auto object-contain" />
                      </span>
                      <span className="block truncate px-1.5 py-1 text-[11px] font-semibold">{f.name}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </Sheet>
        } />
      <Tabs active={tab} items={[
        { key: "desain", label: "Desain & Postingan", href: "/studio?tab=desain" },
        { key: "frame", label: `Frame (${frames.length})`, href: "/studio?tab=frame" },
        { key: "file", label: "File Ekspor", href: "/studio?tab=file" },
      ]} />
      {!storage && <p className="mb-4 rounded-xl bg-warnsoft px-4 py-3 text-sm font-semibold text-warn">Supabase Storage belum aktif di server: foto dari perangkat, frame, dan hasil ekspor tidak bisa disimpan online. Foto customer dan unduh langsung tetap bisa dipakai.</p>}

      {tab === "desain" && (
        <section>
          <form className="mb-4 flex flex-wrap gap-2">
            <input type="hidden" name="tab" value="desain" />
            <div className="relative min-w-40 flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input name="q" defaultValue={sp.q} placeholder="Cari nama, customer, caption…" className="input !pl-10" />
            </div>
            <select name="k" defaultValue={sp.k ?? ""} className="input !w-auto"><option value="">Semua jenis</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select name="st" defaultValue={sp.st ?? ""} className="input !w-auto"><option value="">Semua status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <button className="btn">Filter</button>
          </form>
          {shown.length === 0 ? <Empty title="Belum ada desain" hint="Klik “Desain Baru” untuk membuat postingan feed, carousel, story, atau foto dengan frame photobooth." /> : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {shown.map((d, i) => {
                const ex = exportsAll.filter((e) => e.design_id === d.id);
                return (
                  <Sheet key={d.id} title={d.name} trigger={
                    <button className="card hover-lift anim-rise group w-full overflow-hidden text-left" style={{ ["--i" as string]: Math.min(i, 8) }}>
                      <span className="editor-checker relative block aspect-[4/5] overflow-hidden">
                        {d.thumb_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={d.thumb_url} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                          : <span className="grid size-full place-items-center text-muted"><Icon name="camera" className="size-8" /></span>}
                        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">{KIND[d.kind] ?? d.kind}{d.pages > 1 ? ` · ${d.pages} slide` : ""}</span>
                      </span>
                      <span className="block p-3">
                        <span className="block truncate font-semibold">{d.name}</span>
                        <span className="mt-1 flex items-center justify-between gap-2">
                          <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                          <span className="truncate text-[11px] text-muted">{d.customer ? `${d.customer} · ` : ""}{fmtDateTime(d.updated_at)}</span>
                        </span>
                      </span>
                    </button>}>
                    <DesignDetail id={d.id} name={d.name} status={d.status} caption={d.caption} tags={d.tags} exports={ex} openHref={`/editor/${d.id}`} />
                  </Sheet>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "frame" && (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-xl text-sm text-muted">Upload frame photobooth dengan area foto <b>hijau polos</b>. Hijau dihapus otomatis dan menjadi slot foto — desain bisa dipakai kasir untuk menempel foto customer.</p>
            {admin && (
              <Sheet title="Upload Frame" wide trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Upload Frame</button>}>
                <FrameUploader storage={storage} />
              </Sheet>
            )}
          </div>
          {frames.length === 0 ? <Empty title="Belum ada frame" hint="Buat desain frame di Canva/Photoshop, warnai area foto dengan hijau #00FF00, lalu upload di sini." /> : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {frames.map((f, i) => (
                <div key={f.id} className={`card hover-lift anim-rise overflow-hidden ${f.active ? "" : "opacity-55"}`} style={{ ["--i" as string]: Math.min(i, 8) }}>
                  <Link href={`/editor/baru?kind=frame&frame=${f.id}`} className="editor-checker block p-3" title="Pakai frame ini">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.name} loading="lazy" className="mx-auto h-48 w-auto max-w-full object-contain" />
                  </Link>
                  <div className="p-3">
                    <p className="truncate font-semibold">{f.name}</p>
                    <p className="text-xs text-muted">{FRAME_CATS[f.category] ?? f.category} · {f.slots.length} slot · {f.w}×{f.h}</p>
                    <div className="mt-2 flex gap-2">
                      <Link href={`/editor/baru?kind=frame&frame=${f.id}`} className="btn btn-sm !min-h-8 flex-1">Pakai</Link>
                      {admin && <Sheet title="Edit Frame" trigger={<button className="btn btn-sm !min-h-8" aria-label="Edit"><Icon name="edit" className="size-4" /></button>}><FrameEdit id={f.id} name={f.name} category={f.category} active={f.active} /></Sheet>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "file" && (
        <section>
          {exportsAll.length === 0 ? <Empty title="Belum ada file ekspor" hint="Di editor, pilih Ekspor / Cetak → “Simpan ke File”. File yang disimpan muncul di sini, siap diunduh atau dibagikan." /> : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {exportsAll.map((e, i) => (
                <div key={e.id} className="card anim-rise overflow-hidden" style={{ ["--i" as string]: Math.min(i, 10) }}>
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="editor-checker block aspect-square overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.url} alt={e.name} loading="lazy" className="size-full object-cover" />
                  </a>
                  <div className="space-y-1.5 p-3">
                    <p className="truncate text-sm font-semibold" title={e.name}>{e.name}</p>
                    <p className="truncate text-[11px] text-muted">{e.design_name ? `${e.design_name} · ` : ""}{e.w}×{e.h} · {e.format.toUpperCase()} · {kb(e.size_bytes)}</p>
                    <ExportActions e={e} canDelete={admin} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
