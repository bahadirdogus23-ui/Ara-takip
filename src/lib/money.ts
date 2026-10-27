// Para hesapları tam sayı kuruş ile yapılır; JavaScript'in ondalık hatası
// (ör. 10.05 * 10 = 100.49999…) yuvarlamayı bozmasın.
// Kural veritabanındaki expense_summary ile aynıdır: KDV her satırda ayrı,
// yarım kuruş yukarı yuvarlanır.

export const toKurus = (tl: number) => Math.round(tl * 100);
export const toTL = (kurus: number) => kurus / 100;

// Satırın KDV'si (kuruş)
export const vatKurus = (amountTl: number, ratePercent: number) =>
  Math.round((toKurus(amountTl) * ratePercent) / 100);

export function expenseTotals(rows: { amount: number; vat_rate: number }[]) {
  let net = 0;
  let vat = 0;
  for (const r of rows) {
    net += toKurus(Number(r.amount));
    vat += vatKurus(Number(r.amount), Number(r.vat_rate));
  }
  return { net: toTL(net), vat: toTL(vat), total: toTL(net + vat) };
}
