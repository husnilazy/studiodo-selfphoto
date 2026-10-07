import "server-only";
import { q } from "./db";

export type Studio = { name: string; address: string; phone: string; open: string; close: string; slot: number; footer: string };

export async function getStudio(): Promise<Studio> {
  const [r] = await q<{ value: Studio }>("select value from settings where key = 'studio'");
  return { ...{ name: "STUDIODO", address: "", phone: "", open: "09:00", close: "21:00", slot: 30, footer: "" }, ...(r?.value ?? {}) };
}

export type PackageRow = {
  id: number; name: string; category: string; price: number; duration_min: number; max_people: number;
  per_person: boolean; bookable_online: boolean; option_label: string; options: string; room_ids: number[];
};
export const PACKAGE_SELECT = `select p.id, p.name, p.category, p.price, p.duration_min, p.max_people, p.per_person, p.bookable_online, p.option_label, p.options,
  coalesce((select array_agg(pr.room_id order by pr.room_id) from package_rooms pr where pr.package_id = p.id), '{}') as room_ids from packages p`;
export const activePackages = () =>
  q<PackageRow>(`${PACKAGE_SELECT} where p.active order by case p.category when 'self_photo' then 0 when 'photobox' then 1 when 'photobooth' then 2 else 3 end, p.price`);
export const activeRooms = () => q<{ id: number; name: string; color: string }>("select id, name, color from rooms where active order by sort, id");
export const activeAddons = () => q<{ id: number; name: string; price: number }>("select id, name, price from addons where active order by sort, id");

export type BookingListRow = {
  id: number; code: string; start_at: string; end_at: string; status: string; people: number; total: number; paid: number;
  customer_id: number; customer_name: string; customer_phone: string;
  package_name: string | null; room_id: number | null; room_name: string | null; room_color: string | null; source: string; started_at: string | null; finished_at: string | null;
};

export async function listBookings(f: { from?: string; to?: string; status?: string; term?: string; customerId?: number; limit?: number; order?: "asc" | "desc" }) {
  const term = (f.term ?? "").trim();
  return q<BookingListRow>(
    `select b.id, b.code, b.start_at, b.end_at, b.status, b.people, b.total, b.source, b.started_at, b.finished_at,
            c.id as customer_id, c.name as customer_name, c.phone as customer_phone,
            p.name as package_name, r.id as room_id, r.name as room_name, r.color as room_color,
            coalesce((select sum(case when y.kind = 'refund' then -y.amount else y.amount end)
                        from payments y where y.booking_id = b.id and not y.voided), 0) as paid
       from bookings b
       join customers c on c.id = b.customer_id
       left join packages p on p.id = b.package_id
       left join rooms r on r.id = b.room_id
      where ($1::text is null or (b.start_at at time zone 'Asia/Jakarta')::date >= $1::date)
        and ($2::text is null or (b.start_at at time zone 'Asia/Jakarta')::date <= $2::date)
        and ($3::text is null or b.status = $3)
        and ($4::int is null or b.customer_id = $4)
        and ($5 = '' or c.name ilike $6 or c.phone ilike $6 or b.code ilike $6)
      order by b.start_at ${f.order === "desc" ? "desc" : "asc"}
      limit $7`,
    [f.from ?? null, f.to ?? null, f.status || null, f.customerId ?? null, term, `%${term.replace(/[%_]/g, "")}%`, f.limit ?? 200],
  );
}
