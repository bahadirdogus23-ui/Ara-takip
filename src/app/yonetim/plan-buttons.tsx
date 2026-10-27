"use client";

import { useActionState, useRef } from "react";
import { setPlan } from "./actions";

export function PlanButtons({ id, status }: { id: string; status: string }) {
  const [state, action] = useActionState(setPlan, null);
  // Basılan düğmenin işlemi gizli alana yazılır (gönderen düğmenin değeri her tarayıcıda forma eklenmiyor)
  const islem = useRef<HTMLInputElement>(null);
  const pick = (v: string) => () => {
    if (islem.current) islem.current.value = v;
  };
  const btn = "btn-secondary min-h-9 px-3 text-xs";
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input ref={islem} type="hidden" name="islem" defaultValue="" />
      <button onClick={pick("ay")} className={btn}>
        1 ay aktif et
      </button>
      <button onClick={pick("yil")} className={btn}>
        1 yıl aktif et
      </button>
      <button onClick={pick("suresiz")} className={btn}>
        Süresiz
      </button>
      {status !== "suspended" && (
        <button
          onClick={pick("askiya")}
          className="min-h-9 px-2 text-xs font-medium text-red-700 dark:text-red-400"
        >
          Askıya al
        </button>
      )}
      {state?.message && (
        <span className="text-xs text-green-700 dark:text-green-400">
          {state.message}
        </span>
      )}
      {state?.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
