import type { APIRoute } from "astro";
import { pseudoRandom } from "../../lib/comments/adorable";
import { getOrCreateAlias } from "../../lib/comments/diceware";

// The 25 body parts, inlined: an SVG used as a favicon cannot fetch other files.
const PART_DATA: Record<string, string> = {};
for (const [path, url] of Object.entries(
  import.meta.glob("../../assets/adorable/favicon/*.png", {
    eager: true,
    query: "?inline",
    import: "default",
  })
)) {
  PART_DATA[path.split("/").pop()!] = url as string;
}

export const GET: APIRoute = async ({ cookies }) => {
  // Get existing alias or create new one (sets cookie if new)
  const alias = getOrCreateAlias(cookies);

  // The same face the comment section shows for this alias
  const { eyes, nose, mouth, background } = pseudoRandom(alias);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="rgb(${background.join(",")})"/>
<image width="400" height="400" href="${PART_DATA[`eyes${eyes}.png`]}"/>
<image width="400" height="400" href="${PART_DATA[`nose${nose}.png`]}"/>
<image width="400" height="400" href="${PART_DATA[`mouth${mouth}.png`]}"/>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=3600", // Cache 1 hour, user-specific
    },
  });
};
