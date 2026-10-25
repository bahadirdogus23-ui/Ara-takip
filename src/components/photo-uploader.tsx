"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addPhoto } from "@/app/(app)/fotograflar/actions";
import { PHOTO_BUCKET, PHOTO_KINDS, photoPath, type PhotoKind } from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";

// Telefon fotoğrafları 3-8 MB olur; şantiye internetinde yavaş. Yüklemeden önce
// uzun kenar 1600 px, JPEG %75'e küçültülür (genelde 200-400 KB).
async function compress(file: File, maxSide = 1600, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Görüntü işlenemedi"))), "image/jpeg", quality));
}

export function PhotoUploader({ tenantId, siteId, date }: { tenantId: string; siteId: string; date: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<PhotoKind>("kantar");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    let done = 0;
    try {
      const supabase = createClient();
      for (const file of Array.from(files)) {
        const blob = await compress(file);
        const path = photoPath(tenantId, siteId, date, crypto.randomUUID());
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw new Error("Yüklenemedi, internet bağlantınızı kontrol edin");
        const res = await addPhoto({ siteId, path, kind, caption, takenOn: date });
        if (!res.ok) throw new Error(res.error);
        done++;
      }
      setCaption("");
      setMessage({ text: done > 1 ? `${done} fotoğraf eklendi` : "Fotoğraf eklendi" });
      router.refresh();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Fotoğraf eklenemedi", error: true });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Fotoğraf türü">
        {Object.entries(PHOTO_KINDS).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k as PhotoKind)}
            className={`min-h-10 rounded-full border px-4 text-sm font-medium ${
              kind === k ? "border-brand bg-brand text-white dark:text-black" : "border-line bg-surface"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Açıklama</span>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} placeholder="İsteğe bağlı, ör. fiş no 4512" className="input" />
      </label>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        id="photo-input"
        onChange={(e) => upload(e.target.files)}
        disabled={busy}
      />
      <label htmlFor="photo-input" className={`btn-primary w-full cursor-pointer gap-2 ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
        {busy ? "Yükleniyor…" : "Fotoğraf çek / seç"}
      </label>
      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
