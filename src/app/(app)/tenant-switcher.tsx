"use client";

import type { TenantOption } from "@/lib/context";
import { switchTenant } from "./actions";

export function TenantSwitcher({ tenants, activeId }: { tenants: TenantOption[]; activeId: string }) {
  return (
    <form action={switchTenant}>
      <label htmlFor="tenant" className="sr-only">
        Firma
      </label>
      <select
        id="tenant"
        name="tenant"
        defaultValue={activeId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-full truncate bg-transparent text-sm font-semibold outline-none"
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </form>
  );
}
