export type SiteService = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  video_url: string | null;
};

export type SiteCatalogItem = {
  id: number;
  category: string;
  title: string;
  unit_label: string | null;
  price: number | string;
  description: string | null;
  measurement_hint: string | null;
  image_url: string | null;
};

export function whatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 9 ? `51${digits}` : digits;
}

export function toInstagramEmbedUrl(url: string): string {
  const clean = url.trim().split('?')[0].replace(/\/+$/, '');
  return `${clean}/embed`;
}

export function isInstagramUrl(url: string): boolean {
  return /instagram\.com/i.test(url);
}

/** Cloudinary genera un thumbnail solo con cambiar la extension del video a .jpg. */
export function cloudinaryVideoPoster(url: string): string | undefined {
  if (!/res\.cloudinary\.com\/.+\/video\/upload\//.test(url)) return undefined;
  return url.replace(/\.[a-z0-9]+(\?.*)?$/i, '.jpg$1');
}
