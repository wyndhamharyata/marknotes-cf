// Kopimap owns these facts; marknotes only reads them.
export interface KopimapShop {
  id: string;
  name: string;
  address: string;
  open_hours: string;
  lat: number;
  lng: number;
  status: "known" | "reviewed" | "closed";
  photos: { id: string; url: string; alt: string }[];
}

export async function fetchShop(coffeeId: string): Promise<KopimapShop | null> {
  const id = encodeURIComponent(coffeeId);
  // The edge cache keeps Kopimap off the article's critical path.
  const cached = { cf: { cacheTtl: 600 } } as RequestInit;
  const [shopResp, photosResp] = await Promise.all([
    fetch(`https://kopimap.mwyndham.dev/api/coffees/${id}`, cached).catch(() => null),
    fetch(`https://kopimap.mwyndham.dev/api/coffees/images/${id}`, cached).catch(() => null),
  ]);
  if (!shopResp?.ok) return null;

  const { coffee } = (await shopResp.json()) as { coffee?: Omit<KopimapShop, "photos"> };
  if (!coffee) return null;
  const photos = photosResp?.ok ? ((await photosResp.json()) as KopimapShop["photos"]) : [];
  return { ...coffee, photos };
}
