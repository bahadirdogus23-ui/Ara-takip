import { DeleteButton } from "@/components/form";
import { deletePhoto } from "@/app/(app)/fotograflar/actions";
import { formatDateTR } from "@/lib/format";
import { PHOTO_KINDS } from "@/lib/photos";

export type GridPhoto = { id: string; url: string | null; kind: string; caption: string | null; takenOn: string; canDelete: boolean };

export function PhotoGrid({ photos, showDate }: { photos: GridPhoto[]; showDate?: boolean }) {
  if (!photos.length) return <p className="card text-sm text-muted">Fotoğraf yok.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-xl border border-line bg-surface">
          {p.url ? (
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- imzalı, süreli adres; Next görsel optimizasyonundan geçmez */}
              <img src={p.url} alt={p.caption ?? PHOTO_KINDS[p.kind as keyof typeof PHOTO_KINDS] ?? "Fotoğraf"} loading="lazy" className="aspect-square w-full object-cover" />
            </a>
          ) : (
            <div className="flex aspect-square items-center justify-center text-xs text-muted">Görüntü alınamadı</div>
          )}
          <div className="space-y-0.5 p-2 text-xs">
            <p className="font-semibold">{PHOTO_KINDS[p.kind as keyof typeof PHOTO_KINDS] ?? p.kind}</p>
            {showDate && <p className="text-muted">{formatDateTR(p.takenOn)}</p>}
            {p.caption && <p className="text-muted">{p.caption}</p>}
            {p.canDelete && <DeleteButton action={deletePhoto} id={p.id} confirmText="Bu fotoğraf silinsin mi?" />}
          </div>
        </li>
      ))}
    </ul>
  );
}
