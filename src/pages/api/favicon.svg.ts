import type { APIRoute } from "astro";
import { minidenticon } from "minidenticons";
import { getOrCreateAlias } from "../../lib/comments/diceware";

export const GET: APIRoute = async ({ cookies }) => {
  // Get existing alias or create new one (sets cookie if new)
  const alias = getOrCreateAlias(cookies);

  // Generate SVG (same params as Avatar.tsx)
  const svg = minidenticon(alias, 95, 45);

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=3600", // Cache 1 hour, user-specific
    },
  });
};
