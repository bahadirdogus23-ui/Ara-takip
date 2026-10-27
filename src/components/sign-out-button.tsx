"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { readQueue } from "@/lib/offline-queue";
import { clearCachedPages } from "./sw-register";

export function SignOutButton({
  className,
  label = "Çıkış",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <form
      action={signOut}
      onSubmit={(e) => {
        const waiting = readQueue().length;
        if (
          waiting > 0 &&
          !confirm(
            `${waiting} sefer henüz gönderilmedi. Telefonda saklanacak ve aynı kullanıcıyla tekrar giriş yapınca gönderilecek. Çıkış yapılsın mı?`,
          )
        ) {
          e.preventDefault();
          return;
        }
        clearCachedPages();
      }}
    >
      <button className={className}>
        <LogOut className="size-4" aria-hidden />
        {label}
      </button>
    </form>
  );
}
