import Icon from "./Icon";
import Sheet from "./Sheet";
import { ActionButton } from "./ActionForm";
import { Badge } from "./ui";
import FileForm, { type FileRow } from "./FileForm";
import { FILE_KIND_LABEL, FILE_STATUS_LABEL, fmtDate, waLink } from "@/lib/format";
import { setFileStatus } from "@/app/actions/customers";

export type FileItem = FileRow & { customer_name?: string; customer_phone?: string; booking_code?: string | null };

const TONE: Record<string, string> = { proses: "amber", siap: "indigo", terkirim: "green" };

export default function FileList({
  files, today, showCustomer = false, bookings,
}: { files: FileItem[]; today: string; showCustomer?: boolean; bookings?: { id: number; label: string }[] }) {
  return (
    <div className="card divide-y divide-line">
      {files.map((f) => {
        const expired = f.expires_on && f.expires_on < today;
        const msg = `Halo ${f.customer_name ?? ""}, ${f.kind === "video" ? "video" : "foto"} kamu dari STUDIODO sudah siap ✨\n${f.title}\nUnduh di: ${f.url}${f.expires_on ? `\n(Link berlaku sampai ${fmtDate(f.expires_on)})` : ""}\nTerima kasih sudah berfoto di STUDIODO!`;
        return (
          <div key={f.id} className="flex flex-wrap items-center gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accentsoft text-accent"><Icon name={f.kind === "video" ? "camera" : "folder"} /></span>
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate font-semibold">{f.title}</p>
              <p className="truncate text-xs text-muted">
                {showCustomer && <>{f.customer_name} · </>}{FILE_KIND_LABEL[f.kind]}
                {f.booking_code && <> · {f.booking_code}</>}
                {f.expires_on && <span className={expired ? "font-semibold text-bad" : ""}> · s.d. {fmtDate(f.expires_on, { short: true })}{expired && " (kedaluwarsa)"}</span>}
              </p>
            </div>
            <Badge tone={TONE[f.status]}>{FILE_STATUS_LABEL[f.status]}</Badge>
            <div className="flex flex-wrap items-center gap-1.5">
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm" aria-label="Buka link"><Icon name="external" className="size-4" /> Buka</a>
              {f.customer_phone && (
                <a href={waLink(f.customer_phone, msg)} target="_blank" rel="noopener noreferrer" className="btn btn-sm" aria-label="Kirim lewat WhatsApp"><Icon name="chat" className="size-4" /> Kirim</a>
              )}
              {f.status === "proses" && <ActionButton action={setFileStatus.bind(null, f.id, "siap")}>Tandai Siap</ActionButton>}
              {f.status === "siap" && <ActionButton action={setFileStatus.bind(null, f.id, "terkirim")}>Tandai Terkirim</ActionButton>}
              <Sheet title="Edit File" trigger={<button className="btn btn-sm" aria-label="Edit"><Icon name="edit" className="size-4" /></button>}>
                <FileForm file={f} bookings={bookings} />
              </Sheet>
            </div>
          </div>
        );
      })}
    </div>
  );
}
