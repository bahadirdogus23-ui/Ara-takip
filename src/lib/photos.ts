export const PHOTO_BUCKET = "photos";

export const PHOTO_KINDS = {
  kantar: "Kantar fişi",
  saha: "Saha",
  hasar: "Hasar / arıza",
  diger: "Diğer",
} as const;

export type PhotoKind = keyof typeof PHOTO_KINDS;

// <firma>/<şantiye>/<gün>/<uuid>.jpg: veritabanındaki erişim kuralı ilk klasöre (firma) bakar
export function photoPath(
  tenantId: string,
  siteId: string,
  date: string,
  id: string,
) {
  return `${tenantId}/${siteId}/${date}/${id}.jpg`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// Sunucu, istemciden gelen yolun bu firma ve şantiyeye ait olduğunu doğrular
export function isValidPhotoPath(
  path: string,
  tenantId: string,
  siteId: string,
): boolean {
  return new RegExp(
    `^${tenantId}/${siteId}/\\d{4}-\\d{2}-\\d{2}/${UUID}\\.jpg$`,
    "i",
  ).test(path);
}
