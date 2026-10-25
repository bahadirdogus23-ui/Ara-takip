import { formatDateTR } from "@/lib/format";
import { formatTrNumber } from "@/lib/number";

// Gün sonu özeti: WhatsApp grubuna yapıştırılacak düz metin.
// Para tutarı içermez (grupta taşeron ve şoförler de olabilir); yalnızca miktarlar.

export type DailySummaryInput = {
  tenantName: string;
  siteName: string;
  date: string; // ISO
  trips: { plate: string; trips: number; tons: number }[];
  production: { name: string; quantity: number; unit: string }[];
  machines: { plate: string; hours: number; fuel: number }[];
  alerts: string[];
};

export function buildDailySummary(d: DailySummaryInput): string {
  const lines: string[] = [`*${d.siteName}* · ${formatDateTR(d.date)}`, d.tenantName, ""];

  const totalTrips = d.trips.reduce((s, t) => s + t.trips, 0);
  const totalTons = d.trips.reduce((s, t) => s + t.tons, 0);
  lines.push(`🚚 *Sefer: ${totalTrips}*${totalTons ? ` (~${formatTrNumber(totalTons, 0)} ton)` : ""}`);
  for (const t of d.trips) lines.push(`• ${t.plate}: ${t.trips} sefer`);
  if (!d.trips.length) lines.push("• Sefer girilmedi");

  lines.push("", "🏗️ *İmalat*");
  for (const p of d.production) lines.push(`• ${p.name}: ${formatTrNumber(p.quantity)} ${p.unit}`);
  if (!d.production.length) lines.push("• İmalat girilmedi");

  if (d.machines.length) {
    const hours = d.machines.reduce((s, m) => s + m.hours, 0);
    const fuel = d.machines.reduce((s, m) => s + m.fuel, 0);
    lines.push("", `⛽ *Makine: ${formatTrNumber(hours, 1)} saat, ${formatTrNumber(fuel, 0)} L mazot*`);
    for (const m of d.machines) {
      const parts = [m.hours ? `${formatTrNumber(m.hours, 1)} saat` : "", m.fuel ? `${formatTrNumber(m.fuel, 0)} L` : ""].filter(Boolean);
      lines.push(`• ${m.plate}: ${parts.join(", ")}`);
    }
  }

  if (d.alerts.length) {
    lines.push("", "⚠️ *Dikkat*");
    for (const a of d.alerts) lines.push(`• ${a}`);
  }

  lines.push("", "_Hafriyol ile hazırlandı_");
  return lines.join("\n");
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
