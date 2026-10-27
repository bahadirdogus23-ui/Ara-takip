"use client";

import { CloudOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { tapTrip } from "@/app/(app)/sefer/actions";
import {
  flushQueue,
  mine,
  QUEUE_EVENT,
  readQueue,
  readRejected,
  type QueueOwner,
} from "@/lib/offline-queue";

// Telefonda bekleyen seferleri hangi ekranda olunursa olsun gönderir: açılışta, internet
// gelince ve dakikada bir. Bekleyen ya da gönderilemeyen sefer varsa ince bir şerit gösterir.
export function OfflineSync({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  const owner: QueueOwner = useMemo(
    () => ({ tenantId, userId }),
    [tenantId, userId],
  );
  const path = usePathname();
  const [pending, setPending] = useState(0);
  const [rejected, setRejected] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setPending(mine(readQueue(), owner).length);
      setRejected(mine(readRejected(), owner).length);
    };
    const send = () => {
      if (navigator.onLine && mine(readQueue(), owner).length)
        void flushQueue(tapTrip, owner);
    };
    refresh();
    send();
    const timer = window.setInterval(send, 60_000);
    window.addEventListener("online", send);
    window.addEventListener(QUEUE_EVENT, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", send);
      window.removeEventListener(QUEUE_EVENT, refresh);
    };
  }, [owner]);

  // Sayaç ekranı kendi ayrıntılı uyarısını gösteriyor
  if (path.startsWith("/sefer") || (!pending && !rejected)) return null;
  return (
    <Link
      href="/sefer"
      className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <CloudOff className="size-5 shrink-0" aria-hidden />
      <span>
        {pending > 0 &&
          `${pending} sefer telefonda bekliyor, internet gelince gönderilecek. `}
        {rejected > 0 &&
          `${rejected} sefer gönderilemedi, görmek için dokunun.`}
      </span>
    </Link>
  );
}
