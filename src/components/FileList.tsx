import Icon from "./Icon";
import Sheet from "./Sheet";
import { ActionButton } from "./ActionForm";
import { Badge } from "./ui";
import FileForm, { type FileRow } from "./FileForm";
import { FILE_KIND_LABEL, FILE_STATUS_LABEL, emailLink, fmtDate, waLink } from "@/lib/format";
import { setFileStatus, setFolderStatus } from "@/app/actions/customers";

export type FileItem = FileRow & { customer_name?: string; customer_phone?: string; customer_email?: string; booking_code?: string | null };

const TONE: Record<string, string> = { proses: "amber", siap: "indigo", terkirim: "green" };

type Group = { key: string; customerId: number; bookingId: number | null; album: FileItem | null; photos: FileItem[]; head: FileItem };

function Send({ phone, email, msg, subject }: { phone?: string; email?: string; msg: string; subject: string }) {
  return (
    <>
      {phone && <a href={waLink(phone, msg)} target="_blank" rel="noopener noreferrer" className="btn btn-sm" aria-label="Kirim lewat WhatsApp"><Icon name="chat" className="size-4" /> WhatsApp</a>}
      {email && <a href={emailLink(email, subject, msg)} className="btn btn-sm" aria-label="Kirim lewat email"><Icon name="mail" className="size-4" /> Email</a>}
    </>
  );
}

/** Satu baris file/link. `child` = foto di dalam folder (lebih ringkas). */
function Row({ f, today, showCustomer, bookings, child = false }: { f: FileItem; today: string; showCustomer: boolean; bookings?: { id: number; label: string }[]; child?: boolean }) {
  const expired = f.expires_on && f.expires_on < today;
  const msg = `Halo ${f.customer_name ?? ""}, ${f.kind === "video" ? "video" : "foto"} kamu dari STUDIODO sudah siap ✨\n${f.title}\nUnduh di: ${f.url}${f.expires_on ? `\n(Link berlaku sampai ${fmtDate(f.expires_on)})` : ""}\nTerima kasih sudah berfoto di STUDIODO!`;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${child ? "px-4 py-2.5" : "p-4"}`}>
      <span className={`grid shrink-0 place-items-center rounded-xl bg-accentsoft text-accent ${child ? "size-8" : "size-10"}`}><Icon name={f.kind === "video" ? "camera" : "folder"} className={child ? "size-4" : ""} /></span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate font-semibold">{f.title}</p>
        <p className="truncate text-xs text-muted">
          {showCustomer && <>{f.customer_name} · </>}{FILE_KIND_LABEL[f.kind]}
          {f.booking_code && <> · {f.booking_code}</>}
          {f.expires_on && <span className={expired ? "font-semibold text-bad" : ""}> · s.d. {fmtDate(f.expires_on, { short: true })}{expired && " (kedaluwarsa)"}</span>}
        </p>
      </div>
      {!child && <Badge tone={TONE[f.status]}>{FILE_STATUS_LABEL[f.status]}</Badge>}
      <div className="flex flex-wrap items-center gap-1.5">
        <a href={f.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm" aria-label="Buka link"><Icon name="external" className="size-4" /> Buka</a>
        {!child && <Send phone={f.customer_phone} email={f.customer_email} msg={msg} subject="Foto & video kamu dari STUDIODO" />}
        {!child && f.status === "proses" && <ActionButton action={setFileStatus.bind(null, f.id, "siap")}>Tandai Siap</ActionButton>}
        {!child && f.status === "siap" && <ActionButton action={setFileStatus.bind(null, f.id, "terkirim")}>Tandai Terkirim</ActionButton>}
        <Sheet title="Edit File" trigger={<button className="btn btn-sm" aria-label="Edit"><Icon name="edit" className="size-4" /></button>}>
          <FileForm file={f} bookings={bookings} />
        </Sheet>
      </div>
    </div>
  );
}

export default function FileList({
  files, today, showCustomer = false, bookings,
}: { files: FileItem[]; today: string; showCustomer?: boolean; bookings?: { id: number; label: string }[] }) {
  // Foto hasil upload Drive dikelompokkan per folder (customer + sesi); link manual tetap satu per satu.
  const groups = new Map<string, Group>();
  const order: (Group | FileItem)[] = [];
  for (const f of files) {
    const photo = !!f.drive_file_id && f.kind !== "album";
    if (!photo && f.kind !== "album") { order.push(f); continue; }
    const key = `${f.customer_id}:${f.booking_id ?? 0}`;
    let g = groups.get(key);
    if (!g) { g = { key, customerId: f.customer_id, bookingId: f.booking_id, album: null, photos: [], head: f }; groups.set(key, g); order.push(g); }
    if (f.kind === "album") g.album = f; else g.photos.push(f);
  }
  // Folder tanpa foto (mis. album lama / link folder manual) tetap tampil sebagai baris biasa
  const items = order.map((o) => ("photos" in o && !o.photos.length && o.album ? o.album : o));

  return (
    <div className="card divide-y divide-line">
      {items.map((o) => {
        if (!("photos" in o)) return <Row key={o.id} f={o} today={today} showCustomer={showCustomer} bookings={bookings} />;
        const g = o, h = g.head;
        const st = g.photos.some((p) => p.status === "proses") ? "proses" : g.photos.some((p) => p.status === "siap") || g.album?.status === "siap" ? "siap" : "terkirim";
        const title = g.album?.title ?? (h.booking_code ? `Folder sesi ${h.booking_code}` : `Folder ${h.customer_name ?? ""}`);
        const url = g.album?.url;
        const msg = `Halo ${h.customer_name ?? ""}, foto/video kamu dari STUDIODO sudah siap ✨\nUnduh semuanya di: ${url ?? ""}\nTerima kasih sudah berfoto di STUDIODO!`;
        return (
          <details key={g.key} className="group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accentsoft text-accent"><Icon name="folder" /></span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-semibold">{title}</p>
                <p className="truncate text-xs text-muted">
                  {showCustomer && <>{h.customer_name} · </>}{g.photos.length} file{h.booking_code && <> · {h.booking_code}</>}
                  <span className="text-accent group-open:hidden"> · ketuk untuk lihat isi</span>
                </p>
              </div>
              <Badge tone={TONE[st]}>{FILE_STATUS_LABEL[st]}</Badge>
              <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {url && <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm" aria-label="Buka folder"><Icon name="external" className="size-4" /> Buka</a>}
                {url && <Send phone={h.customer_phone} email={h.customer_email} msg={msg} subject="Foto & video kamu dari STUDIODO" />}
                {st === "proses" && <ActionButton action={setFolderStatus.bind(null, g.customerId, g.bookingId, "siap")}>Tandai Siap</ActionButton>}
                {st === "siap" && <ActionButton action={setFolderStatus.bind(null, g.customerId, g.bookingId, "terkirim")}>Tandai Terkirim</ActionButton>}
              </div>
            </summary>
            <div className="divide-y divide-line border-t border-line bg-panel2/30">
              {g.photos.map((p) => <Row key={p.id} f={p} today={today} showCustomer={false} bookings={bookings} child />)}
            </div>
          </details>
        );
      })}
    </div>
  );
}
