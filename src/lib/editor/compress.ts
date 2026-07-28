import type { AssetKind } from "../asset-key";

interface CompressedImage {
  blob: Blob;
  filename: string;
  contentType: string;
}

// Inline images become permanent git history, so shrink before upload.
const MAX_WIDTH: Record<AssetKind, number> = { hero: 1920, content: 1600 };
const OUTPUT_TYPE = "image/webp";
const QUALITY = 0.85;

export async function compressImage(file: File, kind: AssetKind): Promise<CompressedImage> {
  // Canvas would flatten an animated GIF to a single frame.
  if (file.type === "image/gif") return passthrough(file);

  let bitmap: ImageBitmap;
  try {
    // "from-image" honours the EXIF rotation phone photos rely on.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return passthrough(file);
  }

  try {
    const scale = Math.min(1, MAX_WIDTH[kind] / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return passthrough(file);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_TYPE, QUALITY)
    );

    // Re-encoding an already-tight image can grow it.
    if (!blob || blob.size >= file.size) return passthrough(file);

    return { blob, filename: `${stem(file.name)}.webp`, contentType: OUTPUT_TYPE };
  } finally {
    bitmap.close();
  }
}

function passthrough(file: File): CompressedImage {
  return { blob: file, filename: file.name, contentType: file.type };
}

function stem(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}
