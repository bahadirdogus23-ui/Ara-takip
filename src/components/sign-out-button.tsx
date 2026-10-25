"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { clearCachedPages } from "./sw-register";

export function SignOutButton({ className, label = "Çıkış" }: { className?: string; label?: string }) {
  return (
    <form action={signOut} onSubmit={clearCachedPages}>
      <button className={className}>
        <LogOut className="size-4" aria-hidden />
        {label}
      </button>
    </form>
  );
}
