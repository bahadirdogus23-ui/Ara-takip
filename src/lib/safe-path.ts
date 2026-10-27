// Giriş/doğrulama sonrası yalnızca uygulama içi bir yola yönlendirilir (açık yönlendirmeyi önler).
// "/\evil.com" gibi ters eğik çizgili ya da kontrol karakterli değerler tarayıcıda başka siteye
// dönüşebildiği için reddedilir; çözümlenen adresin kökeni değişmemelidir.
export function safePath(value: unknown, fallback = "/panel"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return fallback;
  try {
    const base = "http://hafriyol.invalid";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}
