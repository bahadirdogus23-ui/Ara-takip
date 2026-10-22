import { SITE_STATUSES } from "@/lib/validation";

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      : status === "paused"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {SITE_STATUSES[status as keyof typeof SITE_STATUSES] ?? status}
    </span>
  );
}
