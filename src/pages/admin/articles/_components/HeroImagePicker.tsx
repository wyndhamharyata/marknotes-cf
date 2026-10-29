import { useEffect, useState } from "preact/hooks";
import { stagedAssetUrl } from "../../../../lib/editor/upload";
import type { KopimapShop } from "../../../../lib/kopimap";

interface Props {
  file?: File;
  uploadedKey?: string;
  /** Hero an earlier publish committed, resolved by the page. */
  committedUrl?: string;
  onSelect: (file: File | undefined) => void;
  /** Coffee reviews only: the shop's Kopimap photos, offered as heroes. */
  photos?: KopimapShop["photos"];
}

// The hero as readers get it once chosen; until then a contact sheet of Kopimap's photos and a file.
export default function HeroImagePicker({
  file,
  uploadedKey,
  committedUrl,
  onSelect,
  photos = [],
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Object URLs leak until revoked.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // A restored draft has the key but not the File; an unchanged hero has neither.
  const previewUrl =
    objectUrl ?? (uploadedKey ? stagedAssetUrl(uploadedKey) : (committedUrl ?? null));

  const accept = (list: FileList | null) => {
    const image = Array.from(list ?? []).find((candidate) => candidate.type.startsWith("image/"));
    if (image) onSelect(image);
  };

  if (previewUrl) {
    return (
      <div class="halftone hero hero-pick">
        <img src={previewUrl} alt="" />
        <button
          type="button"
          class="key key-sm key-sq"
          aria-label="Remove hero image"
          onClick={() => onSelect(undefined)}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div class="contact">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          class="frame"
          disabled={importing !== null}
          onClick={async () => {
            setImporting(photo.id);
            // A File, so publish uploads it exactly like a dropped image.
            const resp = await fetch(
              `/api/admin/coffee/photo?url=${encodeURIComponent(photo.url)}`
            );
            if (resp.ok) {
              const blob = await resp.blob();
              onSelect(
                new File([blob], photo.url.split("/").pop() ?? "kopimap", { type: blob.type })
              );
            }
            setImporting(null);
          }}
        >
          <img src={photo.url} alt={photo.alt} />
          {importing === photo.id && <span class="busy">…</span>}
        </button>
      ))}
      <label
        class={`frame add ${dragging ? "over" : ""}`}
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
        Choose a file
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          class="hidden"
          onChange={(e) => accept(e.currentTarget.files)}
        />
      </label>
    </div>
  );
}
