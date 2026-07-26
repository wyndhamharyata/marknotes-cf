/**
 * Downscale-and-re-encode before upload, using only platform APIs so the admin
 * bundle stays small (no browser-image-compression, no pica).
 *
 * This matters more here than in a typical uploader: inline images are
 * committed to the repository, so every uploaded byte is permanent history that
 * CI re-clones on each publish. A 2MB screenshot typically lands around 180KB.
 */
export interface CompressedImage {
  blob: Blob;
  filename: string;
  contentType: string;
}

/** Hero renders full-width in a 4xl card; body images sit in the ~800px prose column. */
export const HERO_MAX_WIDTH = 1920;
export const INLINE_MAX_WIDTH = 1600;

const OUTPUT_TYPE = "image/webp";
const QUALITY = 0.85;

/** Canvas flattens animation to a single frame, so animated formats pass through. */
const PASSTHROUGH_TYPES = new Set(["image/gif"]);

const EXTENSION_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export async function compressImage(file: File, maxWidth: number): Promise<CompressedImage> {
  if (PASSTHROUGH_TYPES.has(resolveType(file))) return passthrough(file);

  let bitmap: ImageBitmap;
  try {
    // "from-image" honours EXIF rotation, which phone photos rely on.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return passthrough(file);
  }

  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
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

    // Re-encoding an already-tight image can grow it; keep whichever is smaller.
    if (!blob || blob.size >= file.size) return passthrough(file);

    return {
      blob,
      filename: replaceExtension(file.name, "webp"),
      contentType: OUTPUT_TYPE,
    };
  } finally {
    bitmap.close();
  }
}

function passthrough(file: File): CompressedImage {
  return { blob: file, filename: file.name, contentType: resolveType(file) };
}

/** Some drops arrive with an empty `type`; fall back to the extension. */
function resolveType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? "";
}

function replaceExtension(filename: string, extension: string): string {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return `${stem}.${extension}`;
}
