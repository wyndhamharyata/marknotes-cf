interface Props {
  title: string;
  description: string;
  /** Filename and dates, worded by the caller since only it knows the mode. */
  meta: string;
  slugError: string | null;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
}

export default function MetaFields({
  title,
  description,
  meta,
  slugError,
  onTitle,
  onDescription,
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

      <p class={`font-mono text-sm ${slugError ? "text-error" : "text-base-content/50"}`}>
        {slugError ?? meta}
      </p>
    </div>
  );
}
