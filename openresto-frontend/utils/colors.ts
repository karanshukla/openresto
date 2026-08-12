export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RgbColor {
  if (!hex || typeof hex !== "string") return { r: 0, g: 0, b: 0 };

  // Brand colors can arrive without the leading hash; treat "ff0000" as "#ff0000".
  const normalized = hex.startsWith("#") ? hex : `#${hex}`;
  if (normalized.length === 4) {
    return {
      r: parseInt(normalized[1] + normalized[1], 16),
      g: parseInt(normalized[2] + normalized[2], 16),
      b: parseInt(normalized[3] + normalized[3], 16),
    };
  }
  if (normalized.length === 7) {
    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
