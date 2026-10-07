"use client";
import { useState } from "react";
import ActionForm, { ActionButton } from "@/components/ActionForm";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toaster";
import { Field } from "@/components/ui";
import { deleteDesign, deleteExport, deleteFrame, duplicateDesign, renameFrame, setDesignMeta } from "@/app/actions/studio";
import { FRAME_CATS } from "./FrameUploader";

export type ExportRow = { id: number; name: string; url: string; w: number; h: number; format: string; size_bytes: number; created_at: string };

export const STATUS_LABEL: Record<string, string> = { draf: "Draf", siap: "Siap posting", posted: "Sudah diposting" };

export function CopyText({ text, label }: { text: string; label: string }) {
  return (
    <button type="button" className="btn btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); toast("Disalin"); } catch { toast("Gagal menyalin", "bad"); } }}>
      <Icon name="copy" className="size-4" /> {label}
    </button>
  );
}

export function DesignDetail({ id, name, status, caption, tags, exports, openHref }: {
  id: number; name: string; status: string; caption: string; tags: string; exports: ExportRow[]; openHref: string;
}) {
  const [cap, setCap] = useState(caption);
  const [tg, setTg] = useState(tags);
  const full = `${cap}${tg ? `\n\n${tg}` : ""}`.trim();
  return (
    <div className="space-y-4">
      <ActionForm action={setDesignMeta.bind(null, id)} submit="Simpan info">
        <Field label="Nama"><input name="name" className="input" defaultValue={name} /></Field>
        <Field label="Status">
          <select name="status" className="input" defaultValue={status}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        <Field label={`Caption (${cap.length}/2200)`}>
          <textarea name="caption" className="input !min-h-28" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="Tulis caption postingan…" maxLength={2200} />
        </Field>
        <Field label="Hashtag" hint="mis. #studiodo #selfphoto #photobox"><input name="tags" className="input" value={tg} onChange={(e) => setTg(e.target.value)} /></Field>
      </ActionForm>
      <div className="flex flex-wrap gap-2">
        <CopyText text={full} label="Salin caption + hashtag" />
        <a className="btn btn-primary btn-sm" href={openHref}><Icon name="edit" className="size-4" /> Buka di editor</a>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">File ekspor ({exports.length})</p>
        {exports.length === 0 ? <p className="text-sm text-muted">Belum ada. Di editor: Ekspor / Cetak → “Simpan ke File”.</p> : (
          <div className="grid grid-cols-3 gap-2">
            {exports.map((e) => (
              <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-panel2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.url} alt={e.name} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <ActionButton action={duplicateDesign.bind(null, id)} className="btn btn-sm flex-1"><Icon name="copy" className="size-4" /> Duplikat</ActionButton>
        <ActionButton action={deleteDesign.bind(null, id)} confirm="Hapus desain ini? File ekspor tidak ikut terhapus." className="btn btn-sm btn-danger flex-1"><Icon name="trash" className="size-4" /> Hapus</ActionButton>
      </div>
    </div>
  );
}

export function FrameEdit({ id, name, category, active }: { id: number; name: string; category: string; active: boolean }) {
  return (
    <>
      <ActionForm action={renameFrame.bind(null, id)}>
        <Field label="Nama frame"><input name="name" className="input" defaultValue={name} required /></Field>
        <Field label="Jenis"><select name="category" className="input" defaultValue={category}>{Object.entries(FRAME_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={active} className="size-5 accent-[var(--accent)]" /> Tampil di editor</label>
      </ActionForm>
      <ActionForm action={deleteFrame.bind(null, id)} submit="Hapus frame" danger confirm="Hapus frame ini? Desain lama yang memakainya tetap utuh." className="mt-2" />
    </>
  );
}

export function ExportActions({ e, canDelete }: { e: ExportRow; canDelete: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <a href={e.url} download={e.name} target="_blank" rel="noopener noreferrer" className="btn btn-sm !min-h-8"><Icon name="download" className="size-4" /></a>
      <CopyText text={e.url} label="Link" />
      {canDelete && <ActionButton action={deleteExport.bind(null, e.id)} confirm="Hapus catatan file ini?" className="btn btn-sm btn-danger !min-h-8"><Icon name="trash" className="size-4" /></ActionButton>}
    </div>
  );
}
