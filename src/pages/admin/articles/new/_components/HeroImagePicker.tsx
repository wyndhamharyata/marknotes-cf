import { useEffect, useState } from "preact/hooks";
import { stagedAssetUrl } from "../../../../../lib/editor/upload";

interface Props {
  file?: File;
  uploadedKey?: string;
  onSelect: (file: File | undefined) => void;
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";

/**
 * Sits at the top of the preview column, standing in for the hero on the real
 * article page. astro-icon resolves at build time and cannot be used inside an
 * island, so the arrow is inline (heroicons `arrow-down-tray`).
 */
export default function HeroImagePicker({ file, uploadedKey, onSelect }: Props) {
  const [dragging, setDragging] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Object URLs leak until revoked, and the hero can be replaced repeatedly.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // A restored draft has the key but not the File, so fall back to staging.
  const previewUrl = objectUrl ?? (uploadedKey ? stagedAssetUrl(uploadedKey) : null);

  const accept = (list: FileList | null) => {
    const image = Array.from(list ?? []).find((candidate) => candidate.type.startsWith("image/"));
    if (image) onSelect(image);
  };

  if (previewUrl) {
    return (
      <div class="relative">
        <img src={previewUrl} alt="" class="max-h-64 w-full object-cover" />
        <button
          type="button"
          class="btn btn-circle btn-sm absolute top-3 right-3"
          aria-label="Remove hero image"
          onClick={() => onSelect(undefined)}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div class="bg-base-200 p-3">
      <label
        class={`flex h-56 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          dragging ? "border-primary bg-primary/10" : "border-base-content/25"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer?.files ?? null);
        }}
      >
        <svg
          class="text-base-content/40 h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        <p class="text-base-content/70 mt-3 text-sm">
          <span class="text-base-content font-semibold">Choose a file</span> or drag it here.
        </p>
        <input
          type="file"
          accept={ACCEPT}
          class="hidden"
          onChange={(e) => accept(e.currentTarget.files)}
        />
      </label>
    </div>
  );
}
