import type { KopimapShop } from "../lib/kopimap";
import Cups from "./Cups";

interface Props {
  shop: KopimapShop;
  /** From the article's frontmatter, so the block never disagrees with the review. */
  rating?: number;
}

// Shared with the editor preview, so the author sees what readers get.
export default function ShopBlock({ shop, rating = 0 }: Props) {
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
      <div class="tk-map" aria-hidden="true">
        <MockMap seed={shop.id} />
        {/* The reviewed shop's chop, selected: Kopimap's crop marks around it. */}
        <span class="crop">
          <i />
          <i />
          <i />
          <i />
          <span class="map-stamp" />
        </span>
      </div>
    </section>
  );
}

// A printed street plan, not the real one: Open in Kopimap and Directions carry the place.
// Laid out from the shop's id, so each ticket differs and the same shop always looks the same.
function MockMap({ seed }: { seed: string }) {
  let h = 7;
  for (const c of seed) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  const rand = () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) | 0;
    return ((h >>> 0) % 10000) / 10000;
  };
  const angle = rand() * 30 - 15;
  const sx = 40 + rand() * 14;
  const sy = 30 + rand() * 12;
  const blocks = [];
  const streets = [];
  // Drawn past the edges, so the turned grid still fills the frame.
  for (let x = -200; x < 500; x += sx) streets.push(`M${x} -200V400`);
  for (let y = -200; y < 400; y += sy) streets.push(`M-200 ${y}H500`);
  for (let x = -200; x < 500; x += sx) {
    for (let y = -200; y < 400; y += sy) {
      const park = rand() < 0.08;
      const w = park ? sx - 8 : (sx - 10) * (0.45 + rand() * 0.5);
      const hh = park ? sy - 8 : (sy - 10) * (0.45 + rand() * 0.5);
      blocks.push(
        <rect key={`${x},${y}`} class={park ? "park" : "bldg"} x={x + 4 + rand() * (sx - 8 - w)} y={y + 4 + rand() * (sy - 8 - hh)} width={w} height={hh} />,
      );
    }
  }
  const road = `M-200 ${100 + (rand() - 0.5) * 80}L500 ${100 + (rand() - 0.5) * 120}`;
  return (
    <svg class="tk-plan" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
      <g transform={`rotate(${angle} 150 100)`}>
        <path class="minor" d={streets.join("")} />
        {blocks}
        <path class="casing" d={road} />
        <path class="major" d={road} />
      </g>
    </svg>
  );
}
