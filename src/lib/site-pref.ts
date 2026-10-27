import { cookies } from "next/headers";

// Son seçilen şantiye hatırlanır: sahada kullanıcı her ekranda yeniden seçmek zorunda kalmasın.
// Çerez yalnızca tercihtir; sayfalar seçimi kullanıcının görebildiği şantiyeler arasından doğrular.
export const SITE_COOKIE = "hafriyol_santiye";

export async function pickSite<T extends { id: string }>(
  sites: T[],
  requested?: string,
): Promise<T | undefined> {
  const remembered = (await cookies()).get(SITE_COOKIE)?.value;
  return (
    sites.find((s) => s.id === requested) ??
    sites.find((s) => s.id === remembered) ??
    sites[0]
  );
}
