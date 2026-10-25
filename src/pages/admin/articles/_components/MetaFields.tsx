import type { KopimapShop } from "../../../../lib/kopimap";

interface Props {
  title: string;
  description: string;
  /** Filename and dates, worded by the caller since only it knows the mode. */
  meta: string;
  slugError: string | null;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  /** Coffee reviews only: the Kopimap shop this article reviews. */
  shop?: KopimapShop;
  rating?: number;
  onRating: (value: number) => void;
}

export default function MetaFields({
  title,
  description,
  meta,
  slugError,
  onTitle,
  onDescription,
  shop,
  rating,
  onRating,
}: Props) {
  return (
    <div class="border-base-300 flex flex-col gap-1 border-b px-4 py-3">
      <input
        type="text"
        class="input input-ghost h-auto w-full border-0 px-0 py-1 text-2xl font-bold focus:outline-none"
        placeholder="Article title"
        value={title}
        onInput={(event) => onTitle(event.currentTarget.value)}
        // Typing over the seeded "Untitled" should not need a manual select.
        onFocus={(event) => {
          if (event.currentTarget.value === "Untitled") event.currentTarget.select();
        }}
      />

      <textarea
        class="textarea textarea-ghost min-h-0 w-full resize-none border-0 px-0 py-1 text-base leading-snug focus:outline-none"
        rows={2}
        placeholder="Description — shown in listings, search results and social cards"
        value={description}
        onInput={(event) => onDescription(event.currentTarget.value)}
      />

      {shop && (
        // Same control as Kopimap's shop form, so both apps show the same stars.
        <div class="flex items-center gap-3 py-1">
          <div class="rating rating-half rating-sm">
            {[...Array(10)].map((_, i) => (
              <input
                key={i}
                type="radio"
                name="review-rating"
                class={`mask ${i % 2 === 0 ? "mask-half-1" : "mask-half-2"} mask-star-2 bg-accent`}
                aria-label={`${(i + 1) / 2} star`}
                checked={rating === (i + 1) / 2}
                onChange={() => onRating((i + 1) / 2)}
              />
            ))}
          </div>
          <span class="text-base-content/50 font-mono text-sm">
            {rating ? `rating: ${rating}` : "Set a rating"}
          </span>
        </div>
      )}

      <p class={`font-mono text-sm ${slugError ? "text-error" : "text-base-content/50"}`}>
        {slugError ?? meta}
        {shop && !slugError && (
          <>
            {` · Shop: ${shop.name} · `}
            <a
              class="link link-accent"
              href={`https://kopimap.mwyndham.dev/${shop.id}/edit`}
              target="_blank"
            >
              Edit on Kopimap
            </a>
          </>
        )}
      </p>
    </div>
  );
}
