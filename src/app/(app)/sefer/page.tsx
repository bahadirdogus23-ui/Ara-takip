import { Truck } from "lucide-react";
import Link from "next/link";
import { SitePicker } from "@/components/site-picker";
import { canManage, getContext } from "@/lib/context";
import { formatDateTR, isoDateTR } from "@/lib/format";
import { pickSite } from "@/lib/site-pref";
import { TripCounter, type CounterVehicle } from "./trip-counter";

export const metadata = { title: "Sefer sayacı" };

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso));

export default async function TripCounterPage({ searchParams }: { searchParams: Promise<{ santiye?: string }> }) {
  const { santiye } = await searchParams;
  const { supabase, tenant } = await getContext();
  const manager = canManage(tenant.role);

  const { data: sites } = await supabase.from("sites").select("id, name").eq("tenant_id", tenant.id).eq("status", "active").order("name");
  const site = await pickSite(sites ?? [], santiye);
  if (!site) return <Empty manager={manager} text="Sefer sayabilmek için devam eden bir şantiye olmalı." href="/kurulum" cta="Hızlı kurulum" />;

  const today = isoDateTR();
  const [{ data: vehicles }, { data: routes }, { data: trips }] = await Promise.all([
    supabase.from("vehicles").select("id, plate, vehicle_type, capacity_ton").eq("tenant_id", tenant.id).eq("active", true).order("plate"),
    supabase.from("routes").select("id, name").eq("site_id", site.id).order("name"),
    supabase.from("trip_entries").select("vehicle_id, trip_count, created_at").eq("site_id", site.id).eq("entry_date", today),
  ]);

  const counted: CounterVehicle[] = (vehicles ?? []).map((v) => {
    const mine = (trips ?? []).filter((t) => t.vehicle_id === v.id);
    const last = mine.reduce<string | null>((acc, t) => (!acc || t.created_at > acc ? t.created_at : acc), null);
    return {
      id: v.id,
      plate: v.plate,
      type: v.vehicle_type,
      capacityTon: v.capacity_ton === null ? null : Number(v.capacity_ton),
      trips: mine.reduce((s, t) => s + t.trip_count, 0),
      lastAt: last ? hhmm(last) : null,
    };
  });
  // Sıra plakaya göre sabit: dokundukça kartlar yer değiştirmesin

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sefer sayacı</h1>
          <p className="text-sm text-muted">{formatDateTR(today)} · her dokunuş bir sefer</p>
        </div>
      </div>
      <SitePicker sites={sites ?? []} siteId={site.id} />
      {counted.length === 0 ? (
        <Empty manager={manager} text="Aktif araç yok. Kamyonlarınızı ekleyin, burada büyük sayaçlar olarak çıksın." href="/araclar" cta="Araç ekle" />
      ) : (
        <TripCounter siteId={site.id} vehicles={counted} routes={routes ?? []} />
      )}
    </div>
  );
}

function Empty({ manager, text, href, cta }: { manager: boolean; text: string; href: string; cta: string }) {
  return (
    <div className="card mx-auto max-w-lg text-center">
      <Truck className="mx-auto size-10 text-brand" aria-hidden />
      <p className="mt-2 text-sm text-muted">{text}</p>
      {manager && (
        <Link href={href} className="btn-primary mt-4">
          {cta}
        </Link>
      )}
    </div>
  );
}
