import ActionForm from "./ActionForm";
import CustomerPicker from "./CustomerPicker";
import { Field } from "./ui";
import { FILE_KIND_LABEL, FILE_STATUS_LABEL } from "@/lib/format";
import { deleteFile, saveFile } from "@/app/actions/customers";

export type FileRow = {
  id: number; customer_id: number; booking_id: number | null; title: string; url: string; kind: string;
  status: string; expires_on: string | null; note: string;
};

/** Form tambah/ubah file customer. `customerId` mengunci customer; `bookings` = pilihan booking milik customer itu. */
export default function FileForm({
  file, customerId, bookingId, bookings = [],
}: { file?: FileRow; customerId?: number; bookingId?: number; bookings?: { id: number; label: string }[] }) {
  return (
    <>
      <ActionForm action={saveFile.bind(null, file?.id ?? null, customerId ?? file?.customer_id ?? null)}>
        {!customerId && !file && (
          <Field label="Customer"><CustomerPicker allowNew={false} /></Field>
        )}
        <Field label="Judul"><input name="title" className="input" required defaultValue={file?.title} placeholder="mis. Foto edit sesi 6 Okt" /></Field>
        <Field label="Link file (Google Drive, dll.)" hint="Pastikan akses link sudah diatur 'siapa saja yang punya link'.">
          <input name="url" type="url" className="input" required defaultValue={file?.url} placeholder="https://drive.google.com/…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jenis">
            <select name="kind" className="input" defaultValue={file?.kind ?? "foto_edit"}>
              {Object.entries(FILE_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" className="input" defaultValue={file?.status ?? "proses"}>
              {Object.entries(FILE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        {bookings.length > 0 && (
          <Field label="Terkait booking (opsional)">
            <select name="booking_id" className="input" defaultValue={file?.booking_id ?? bookingId ?? ""}>
              <option value="">— tidak terkait —</option>
              {bookings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Link berlaku sampai (opsional)"><input name="expires_on" type="date" className="input" defaultValue={file?.expires_on ?? ""} /></Field>
        <Field label="Catatan (opsional)"><input name="note" className="input" defaultValue={file?.note} /></Field>
      </ActionForm>
      {file && <ActionForm action={deleteFile.bind(null, file.id)} submit="Hapus file" danger confirm="Hapus file ini dari daftar?" className="mt-2" />}
    </>
  );
}
