import sharp from 'sharp';
import { rename } from 'fs/promises';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 82;

/**
 * Resizes/recompresses a just-uploaded product photo in place so product lists
 * and the catalog don't ship full camera-resolution originals (several MB each)
 * to every viewer. Animated GIFs are left untouched (sharp would flatten them
 * to a single frame).
 */
export async function resizeUploadedImage(filePath: string, mimeType: string) {
  if (mimeType === 'image/gif') {
    return;
  }

  const image = sharp(filePath, { failOn: 'none' });
  const metadata = await image.metadata();

  const needsResize = Boolean(
    metadata.width && metadata.height && Math.max(metadata.width, metadata.height) > MAX_DIMENSION
  );

  let pipeline = image.rotate(); // apply EXIF orientation, then strip it
  if (needsResize) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (mimeType === 'image/png') {
    // Kept lossless (no palette quantization) — quality tuning only matters
    // once quantized, and that can introduce visible banding on photos.
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (mimeType === 'image/webp') {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY });
  } else {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  }

  const tempPath = `${filePath}.tmp`;
  await pipeline.toFile(tempPath);
  await rename(tempPath, filePath);
}
