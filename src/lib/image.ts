import { putImage } from "./idb";

const MAX_EDGE = 1600;
const QUALITY = 0.82;

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    // `imageOrientation` makes iPhone portrait shots come out upright.
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht gelesen werden"));
    };
    img.src = url;
  });
}

/**
 * Downscale to a 1600px long edge and re-encode as JPEG before storing.
 * A raw 12 MP iPhone photo is ~4 MB; this lands around 200–400 KB.
 */
export async function compressImage(file: File): Promise<Blob> {
  const src = await loadBitmap(file);
  const w = "width" in src ? src.width : 0;
  const h = "height" in src ? src.height : 0;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(src as CanvasImageSource, 0, 0, cw, ch);
  if ("close" in src) src.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  return blob ?? file;
}

export function newImageId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Compress, store, and hand back the id to put on the record. */
export async function storeImageFile(
  file: File,
  prefix: string,
): Promise<string> {
  const blob = await compressImage(file);
  const id = newImageId(prefix);
  await putImage(id, blob);
  return id;
}

export async function blobToBase64(blob: Blob): Promise<{
  media_type: string;
  data: string;
}> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return {
    media_type: blob.type || "image/jpeg",
    data: btoa(binary),
  };
}
