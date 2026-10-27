import { PhotoGrid } from "@/components/photo-grid";
import { PhotoUploader } from "@/components/photo-uploader";
import { SitePicker } from "@/components/site-picker";
import { canManage, getContext } from "@/lib/context";
import { formatDateTR, workDateTR, monthRangeTR } from "@/lib/format";
import { loadPhotos } from "@/lib/photo-load";
import { pickSite } from "@/lib/site-pref";

export const metadata = { title: "Fotoğraflar" };

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ santiye?: string }>;
}) {
  const { santiye } = await searchParams;
  const { supabase, user, tenant } = await getContext();
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, day_start_hour")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .order("name");
  const site = await pickSite(sites ?? [], santiye);
  if (!site)
    return (
      <p className="card text-sm text-muted">
        Fotoğraf eklemek için devam eden bir şantiye olmalı.
      </p>
    );

  const today = workDateTR(new Date(), site.day_start_hour);
  const month = monthRangeTR();
  const photos = await loadPhotos(
    supabase,
    { siteId: site.id, ...month },
    (by) => canManage(tenant.role) || by === user.id,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fotoğraflar</h1>
        <p className="text-sm text-muted">
          Kantar fişi, saha ve hasar fotoğrafları · {formatDateTR(month.from)} –{" "}
          {formatDateTR(month.to)}
        </p>
      </div>
      <SitePicker sites={sites ?? []} siteId={site.id} />
      <section className="card">
        <PhotoUploader tenantId={tenant.id} siteId={site.id} date={today} />
      </section>
      <PhotoGrid photos={photos} showDate />
    </div>
  );
}
