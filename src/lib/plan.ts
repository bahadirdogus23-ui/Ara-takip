// Abonelik ödeme bilgileri. Sanal POS bağlanana kadar ödeme havale/EFT ile alınır ve
// Hafriyol yönetim ekranından elle onaylanır. Bilgiler sunucu ortam değişkenlerinden okunur
// (Vercel → Settings → Environment Variables); tanımlı değilse ekranda iletişim notu çıkar.
export function paymentInfo() {
  return {
    price: process.env.HAFRIYOL_ODEME_TUTAR || null, // ör. "Aylık 1.500 TL + KDV"
    iban: process.env.HAFRIYOL_ODEME_IBAN || null,
    receiver: process.env.HAFRIYOL_ODEME_ALICI || null,
    contact: process.env.HAFRIYOL_ILETISIM || null, // ör. telefon / WhatsApp
  };
}
