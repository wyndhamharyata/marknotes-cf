import { useEffect, useState } from "preact/hooks";
import { stagedAssetUrl } from "../../../../../lib/editor/upload";

interface Props {
  file?: File;
  uploadedKey?: string;
  onSelect: (file: File | undefined) => void;
}

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

  return (
    <div class="form-control">
      <div class="label">
        <span class="label-text font-semibold">Hero image</span>
        {previewUrl && (
          <button type="button" class="btn btn-ghost btn-xs" onClick={() => onSelect(undefined)}>
            Remove
          </button>
        )}
      </div>

      <div
        class={`rounded-box border-2 border-dashed p-4 transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-base-300"
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
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Hero preview"
            class="rounded-box mb-3 max-h-48 w-full object-cover"
          />
        )}

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          class="file-input file-input-bordered w-full"
          onChange={(event) => accept(event.currentTarget.files)}
        />

        <p class="text-base-content/60 mt-2 text-xs">
          Drop an image here or click to browse. Uploaded when you publish.
          {uploadedKey && " Already staged."}
        </p>
      </div>
    </div>
  );
}
