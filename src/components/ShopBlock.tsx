import { useEffect, useRef } from "preact/hooks";
import type { KopimapShop } from "../lib/kopimap";
// Static: a dynamically imported stylesheet 404s in the Cloudflare build.
import "maplibre-gl/dist/maplibre-gl.css";

interface Props {
  shop: KopimapShop;
  /** From the article's frontmatter, so the block never disagrees with the review. */
  rating?: number;
}

// Shared by the editor preview and the article, so the author sees what readers get.
export default function ShopBlock({ shop, rating = 0 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  // MapLibre is heavy, so it loads only once the block scrolls into view.
  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;

    let map: { remove: () => void } | undefined;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();

      const { Map, Marker } = await import("maplibre-gl");
      const dark = document.documentElement.classList.contains("dark");
      const created = new Map({
        container,
        style: `https://resource.mwyndham.dev/sono/alidade_smooth_${dark ? "dark" : "light"}.json`,
        center: [shop.lng, shop.lat],
        zoom: 15,
        interactive: false,
        attributionControl: { compact: true },
      });
      new Marker({ color: getComputedStyle(container).color })
        .setLngLat([shop.lng, shop.lat])
        .addTo(created);
      map = created;
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      map?.remove();
    };
  }, [shop.lat, shop.lng]);

  const [open, close] = shop.open_hours.split("-");
  const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  // Kopimap's hours are local to Solo, whatever the reader's time zone.
  const wib = new Date(Date.now() + 7 * 3_600_000);
  const now = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  const from = minutes(open);
  const to = minutes(close);
  // A close earlier than the open, such as 08:00-01:00, ends on the next day.
  const isOpen = from <= to ? now >= from && now < to : now >= from || now < to;
  const allDay = open === "00:00" && close === "23:59";
  const closed = shop.status === "closed";

  return (
    <div class="border-base-300 rounded-box not-prose mb-8 flex flex-col overflow-hidden border-2 md:flex-row">
      <div class="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p class="text-lg font-extrabold">{shop.name}</p>
          {rating > 0 && (
            <div class="rating rating-xs rating-half" aria-label={`${rating} of 5`}>
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  class={`mask mask-star-2 ${i % 2 === 0 ? "mask-half-1" : "mask-half-2"} bg-accent`}
                  aria-current={rating >= (i + 1) / 2}
                />
              ))}
            </div>
          )}
        </div>

        <div class="flex items-center gap-2 text-sm">
          <svg
            class="h-5 w-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <span>{allDay ? "Open 24 hours" : shop.open_hours}</span>
          {closed ? (
            <span class="badge badge-error badge-soft badge-sm">Closed permanently</span>
          ) : (
            !allDay && (
              <span
                class={`badge badge-soft badge-sm ${isOpen ? "badge-success" : "badge-warning"}`}
              >
                {isOpen ? "Open now" : "Closed now"}
              </span>
            )
          )}
        </div>

        <div class="flex items-start gap-2 text-sm">
          <svg
            class="h-5 w-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
            />
          </svg>
          <span class="text-base-content/80">{shop.address}</span>
        </div>

        <div class="mt-1 flex flex-wrap gap-2">
          <a
            class="btn btn-primary btn-sm"
            href={`https://kopimap.mwyndham.dev/?shop=${shop.id}`}
            target="_blank"
          >
            Open in Kopimap
          </a>
          {!closed && (
            <a
              class="btn btn-accent btn-outline btn-sm"
              target="_blank"
              href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}&origin=My+Location&travelmode=driving`}
            >
              Go Here
            </a>
          )}
        </div>
      </div>

      <div
        ref={mapRef}
        class="bg-base-200 text-accent order-first h-36 w-full shrink-0 md:order-none md:h-auto md:min-h-44 md:w-72"
      />
    </div>
  );
}
