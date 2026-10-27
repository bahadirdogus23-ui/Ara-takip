"use client";

import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useSyncExternalStore, useState } from "react";
import { whatsappUrl } from "@/lib/daily-summary";

// Gün sonu özetini WhatsApp'a gönderir; telefonun paylaş menüsü ve kopyalama da var
export function ShareSummary({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  // Sunucuda false, tarayıcıda gerçek değer: ilk çizimde uyuşmazlık olmaz
  const canShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );

  return (
    <div className="space-y-3">
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-3 font-sans text-sm">
        {text}
      </pre>
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 gap-2 bg-[#1fa855] hover:bg-[#178a45]"
        >
          <MessageCircle className="size-5" aria-hidden />
          WhatsApp&apos;a gönder
        </a>
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ text }).catch(() => {})}
            className="btn-secondary gap-2"
          >
            <Share2 className="size-5" aria-hidden />
            Paylaş
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
          className="btn-secondary gap-2"
        >
          <Copy className="size-5" aria-hidden />
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>
    </div>
  );
}
