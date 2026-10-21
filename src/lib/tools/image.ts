// Resize/compress photos on the device (expo-image-manipulator works on Android, iOS and web).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface Processed {
  uri: string;
  base64: string;
  width: number;
  height: number;
  bytes: number;
}

/** Size in bytes of base64-encoded data. */
export const base64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

/** Centre-crops to the target aspect ratio, then resizes to exactly width × height. */
async function render(uri: string, src: { width: number; height: number }, width: number, height: number) {
  const target = width / height;
  const current = src.width / src.height;
  const crop =
    current > target
      ? { width: Math.round(src.height * target), height: src.height, originX: Math.round((src.width - src.height * target) / 2), originY: 0 }
      : { width: src.width, height: Math.round(src.width / target), originX: 0, originY: Math.round((src.height - src.width / target) / 2) };
  return ImageManipulator.manipulate(uri).crop(crop).resize({ width, height }).renderAsync();
}

/**
 * Exact pixel size, and the best JPEG quality that keeps the file at or under maxKB.
 * Returns null if even the lowest quality is too big (choose smaller dimensions).
 */
export async function resizeToFit(
  uri: string,
  src: { width: number; height: number },
  opts: { width: number; height: number; maxKB: number },
): Promise<Processed | null> {
  const image = await render(uri, src, opts.width, opts.height);
  const save = async (compress: number) => {
    const r = await image.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
    return { uri: r.uri, base64: r.base64 ?? '', width: r.width, height: r.height, bytes: base64Bytes(r.base64 ?? '') };
  };
  const limit = opts.maxKB * 1024;
  let best: Processed | null = null;
  let lo = 0.05;
  let hi = 1;
  for (let i = 0; i < 7; i++) {
    const q = (lo + hi) / 2;
    const r = await save(q);
    if (r.bytes <= limit) {
      best = r;
      lo = q;
    } else {
      hi = q;
    }
  }
  if (!best) {
    const r = await save(0.05);
    if (r.bytes <= limit) best = r;
  }
  return best;
}

/** JPEG copy no larger than maxSide pixels, for putting into a PDF. */
export async function toJpeg(uri: string, src: { width: number; height: number }, maxSide = 1600): Promise<Processed> {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const ctx = ImageManipulator.manipulate(uri);
  if (scale < 1) ctx.resize({ width: Math.round(src.width * scale), height: Math.round(src.height * scale) });
  const image = await ctx.renderAsync();
  const r = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  return { uri: r.uri, base64: r.base64 ?? '', width: r.width, height: r.height, bytes: base64Bytes(r.base64 ?? '') };
}
