// Browser-side image compressor. Converts a File to WebP (preserving
// transparency) with a max dimension and quality. No external deps.
// If the result ends up bigger than the original (rare for already-optimized
// inputs), it returns the original file unchanged.

export type CompressOptions = {
  maxDimension?: number; // longest edge in px
  quality?: number; // 0..1
  mimeType?: "image/webp" | "image/jpeg";
};

export async function compressImageFile(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.82;
  const mimeType = opts.mimeType ?? "image/webp";

  // Skip SVG, GIF (animation) and anything that isn't a raster image.
  if (!/^image\/(jpeg|jpg|png|webp|avif)$/i.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const { width: w0, height: h0 } = bitmap;
  const scale = Math.min(1, maxDimension / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, mimeType, quality),
  );
  if (!blob || blob.size >= file.size) return file;

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, { type: mimeType });
}