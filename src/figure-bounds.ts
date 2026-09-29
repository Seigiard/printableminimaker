export type FigureBounds = { x: number; y: number; width: number; height: number };

// Requires width × height RGBA pixels. Alpha > threshold belongs to the figure.
// Returns null for opaque artwork or when no pixel exceeds the threshold.
export function findFigureBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 8,
): FigureBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let hasTransparency = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha < 255) hasTransparency = true;
      if (alpha <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return !hasTransparency || right < 0
    ? null
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
