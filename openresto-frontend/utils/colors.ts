export function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== "string") return `rgba(0,0,0,${alpha})`;

  let r = 0,
    g = 0,
    b = 0;

  // Handle #rgb
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  }
  // Handle #rrggbb
  else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }

  return `rgba(${r},${g},${b},${alpha})`;
}
