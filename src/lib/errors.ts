// Supabase / PostgreSQL hatalarını kullanıcıya gösterilecek Türkçe mesaja çevirir.
// Teknik ayrıntı kullanıcıya gösterilmez, sunucu günlüğüne yazılır.

type DbError = { code?: string; message?: string } | null | undefined;

export function dbErrorMessage(error: DbError): string {
  if (!error) return "Beklenmeyen bir hata oluştu";
  switch (error.code) {
    case "42501": // RLS / yetki
      return "Bu işlem için yetkiniz yok";
    case "23505":
      return "Bu kayıt zaten var";
    case "23503":
      return "Bu kayıt başka kayıtlarda kullanılıyor ya da bağlı olduğu kayıt bulunamadı";
    case "23514":
      return "Girilen değerlerden biri geçersiz";
    case "PGRST116":
      return "Kayıt bulunamadı";
    case "P0001": // veritabanı fonksiyonlarımızın Türkçe iş kuralı mesajları
      return error.message ?? "İşlem yapılamadı";
  }
  console.error("Veritabanı hatası:", error);
  return "İşlem kaydedilemedi, lütfen tekrar deneyin";
}

export function authErrorMessage(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-posta veya şifre hatalı";
    case "email_not_confirmed":
      return "E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu kontrol edin";
    case "user_already_exists":
    case "email_exists":
      return "Bu e-posta ile zaten bir hesap var";
    case "weak_password":
      return "Şifre çok zayıf, daha uzun ve tahmin edilmesi zor bir şifre seçin";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Çok fazla deneme yapıldı, birkaç dakika sonra tekrar deneyin";
  }
  console.error("Kimlik doğrulama hatası:", error);
  return "Giriş yapılamadı, lütfen tekrar deneyin";
}
