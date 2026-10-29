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
  rating = 0,
  onRating,
}: Props) {
  return (
    <div>
      <label class="field">
        <span class="lb">Title</span>
        <input
          type="text"
          class="ruled title-line"
          value={title}
          onInput={(event) => onTitle(event.currentTarget.value)}
          // Typing over the seeded "Untitled" should not need a manual select.
          onFocus={(event) => {
            if (event.currentTarget.value === "Untitled") event.currentTarget.select();
          }}
        />
      </label>

      <label class="field">
        <span class="lb">Description</span>
        <textarea
          class="ruled"
          rows={2}
          value={description}
          onInput={(event) => onDescription(event.currentTarget.value)}
        />
      </label>

      {shop && (
        // Kopimap's cups input, so both apps rate the same way: the left half of a cup sets .5.
        <div class="field">
          <span class="lb">Rating</span>
          <div class="flex items-center gap-3">
            <span class="cups cupin" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <i key={n} class={rating >= n ? "f" : rating >= n - 0.5 ? "h" : undefined}>
                  {[n - 0.5, n].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={`${value} cups`}
                      onClick={() => onRating(value)}
                    />
                  ))}
                </i>
              ))}
            </span>
            <b class="score">{rating ? rating.toFixed(1) : "–"}</b>
          </div>
        </div>
      )}

      {shop && (
        <dl class="from">
          <dt>Shop</dt>
          <i class="leader" />
          <dd>
            {shop.name} ·{" "}
            <a href={`https://kopimap.mwyndham.dev/${shop.id}/edit`} target="_blank">
              Edit on Kopimap
            </a>
          </dd>
        </dl>
      )}

      {slugError ? (
        <p class="err">{slugError}</p>
      ) : (
        <dl class="from">
          <dt>File</dt>
          <i class="leader" />
          <dd class="text-right">{meta}</dd>
        </dl>
      )}
    </div>
  );
}
