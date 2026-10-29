import { useEffect, useRef } from "preact/hooks";
import type { KopimapShop } from "../lib/kopimap";
import Cups from "./Cups";
// Static: a dynamically imported stylesheet 404s in the Cloudflare build.
import "maplibre-gl/dist/maplibre-gl.css";

interface Props {
  shop: KopimapShop;
  /** From the article's frontmatter, so the block never disagrees with the review. */
  rating?: number;
}

// Kopimap's ticket for the shop, stapled to the review. Shared by the editor preview and the
// article, so the author sees what readers get.
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
        style: `https://resource.mwyndham.dev/sono/kopimap_print_${dark ? "dark" : "light"}.json`,
        center: [shop.lng, shop.lat],
        zoom: 15,
        interactive: false,
        attributionControl: { compact: true },
      });
      // The reviewed shop's chop, selected: Kopimap's crop marks around it.
      const mark = document.createElement("div");
      mark.className = "crop";
      mark.innerHTML = '<i></i><i></i><i></i><i></i><span class="map-stamp"></span>';
      new Marker({ element: mark }).setLngLat([shop.lng, shop.lat]).addTo(created);
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
    <section class="tk not-prose">
      <span class="staple" style={{ left: 22 }} />
      <span class="staple" style={{ left: 58 }} />
      <div class="tk-b">
        <h2 class="tk-name">{shop.name}</h2>
        <div class="tk-status">
          <span class="stamp stamp-lg" style={{ "--r": "-3deg" }}>
            Reviewed
          </span>
          {closed && (
            <span class="stamp stamp-lg stamp-ink" style={{ "--r": "2deg" }}>
              Closed
            </span>
          )}
          {rating > 0 && <Cups score={rating} />}
        </div>
        <dl class="facts">
          <div>
            <dt>Hours</dt>
            <i class="leader" />
            <dd>
              {closed ? (
                "Closed permanently"
              ) : allDay ? (
                "Open 24 hours"
              ) : (
                <>
                  {shop.open_hours.replace("-", " – ")}{" "}
                  <span class="now">· {isOpen ? "open now" : "closed now"}</span>
                </>
              )}
            </dd>
          </div>
          <div class="addr">
            <dt>Address</dt>
            <dd>{shop.address}</dd>
          </div>
        </dl>
        <div class="tk-actions">
          <a
            class="key key-signal key-grow"
            href={`https://kopimap.mwyndham.dev/?shop=${shop.id}`}
            target="_blank"
          >
            Open in Kopimap
            <svg class="out" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 5h10v10M19 5 6 18"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="square"
              />
            </svg>
          </a>
          {!closed && (
            <a
              class="key key-grow"
              target="_blank"
              href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}&origin=My+Location&travelmode=driving`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 2.5 21.5 12 12 21.5 2.5 12z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M8.5 15v-4h6M12.5 8l3 3-3 3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="square"
                />
              </svg>
              Directions
            </a>
          )}
        </div>
      </div>
      <div ref={mapRef} class="tk-map" />
    </section>
  );
}
