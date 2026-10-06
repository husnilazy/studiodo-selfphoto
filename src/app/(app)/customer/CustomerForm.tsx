import ActionForm from "@/components/ActionForm";
import { Field } from "@/components/ui";
import { deleteCustomer, saveCustomer } from "@/app/actions/customers";

type C = { id: number; name: string; phone: string; instagram: string; email: string; notes: string };

export default function CustomerForm({ customer, canDelete = false }: { customer?: C; canDelete?: boolean }) {
  return (
    <>
      <ActionForm action={saveCustomer.bind(null, customer?.id ?? null)}>
        <Field label="Nama"><input name="name" className="input" required defaultValue={customer?.name} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="No. WhatsApp"><input name="phone" inputMode="tel" className="input" defaultValue={customer?.phone} placeholder="08xxxxxxxxxx" /></Field>
          <Field label="Instagram"><input name="instagram" className="input" defaultValue={customer?.instagram} placeholder="@username" /></Field>
        </div>
        <Field label="Email (opsional)"><input name="email" type="email" className="input" defaultValue={customer?.email} /></Field>
        <Field label="Catatan"><textarea name="notes" className="input" defaultValue={customer?.notes} placeholder="mis. suka background hitam, alergi flash…" /></Field>
      </ActionForm>
      {customer && canDelete && (
        <ActionForm action={deleteCustomer.bind(null, customer.id)} submit="Hapus customer" danger confirm="Hapus customer ini?" className="mt-2" />
      )}
    </>
  );
}
