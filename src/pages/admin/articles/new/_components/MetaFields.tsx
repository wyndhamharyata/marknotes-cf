interface Props {
  title: string;
  slug: string;
  description: string;
  pubDate: string;
  slugError: string | null;
  onTitle: (value: string) => void;
  onSlug: (value: string) => void;
  onDescription: (value: string) => void;
  onPubDate: (value: string) => void;
}

export default function MetaFields({
  title,
  slug,
  description,
  pubDate,
  slugError,
  onTitle,
  onSlug,
  onDescription,
  onPubDate,
}: Props) {
  return (
    <div class="grid gap-3 md:grid-cols-2">
      <label class="form-control md:col-span-2">
        <div class="label">
          <span class="label-text font-semibold">Title</span>
        </div>
        <input
          type="text"
          class="input input-bordered w-full"
          placeholder="Article title"
          value={title}
          onInput={(event) => onTitle(event.currentTarget.value)}
        />
      </label>

      <label class="form-control md:col-span-2">
        <div class="label">
          <span class="label-text font-semibold">Description</span>
        </div>
        <textarea
          class="textarea textarea-bordered w-full"
          rows={2}
          placeholder="Shown in listings, search results and social cards"
          value={description}
          onInput={(event) => onDescription(event.currentTarget.value)}
        />
      </label>

      <label class="form-control">
        <div class="label">
          <span class="label-text font-semibold">Slug</span>
        </div>
        <input
          type="text"
          class={`input input-bordered w-full font-mono text-sm ${slugError ? "input-error" : ""}`}
          placeholder="derived-from-title"
          value={slug}
          onInput={(event) => onSlug(event.currentTarget.value)}
        />
        <div class="label">
          <span class={`label-text-alt ${slugError ? "text-error" : "text-base-content/60"}`}>
            {slugError ?? `Commits to src/content/blog/${slug || "…"}.mdx`}
          </span>
        </div>
      </label>

      <label class="form-control">
        <div class="label">
          <span class="label-text font-semibold">Publish date</span>
        </div>
        <input
          type="text"
          class="input input-bordered w-full font-mono text-sm"
          value={pubDate}
          onInput={(event) => onPubDate(event.currentTarget.value)}
        />
        <div class="label">
          <span class="label-text-alt text-base-content/60">Format: Jul 26 2026</span>
        </div>
      </label>
    </div>
  );
}
