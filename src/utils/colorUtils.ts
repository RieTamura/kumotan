/**
 * Color utility functions for dynamic color manipulation.
 */

/**
 * Convert a hex color and alpha value to an rgba string.
 * @param hex - 6-digit hex color (e.g. '#3B82F6')
 * @param alpha - opacity from 0 (transparent) to 1 (opaque)
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Blend a foreground hex color over a background hex color.
 * Returns a fully opaque rgb() string — no transparency.
 * @param fg - 6-digit hex foreground color (e.g. '#F59E0B')
 * @param bg - 6-digit hex background color (e.g. '#15202B')
 * @param fgOpacity - how strongly the fg color is applied (0 = all bg, 1 = all fg)
 */
export const blendColors = (fg: string, bg: string, fgOpacity: number): string => {
  const fgR = parseInt(fg.slice(1, 3), 16);
  const fgG = parseInt(fg.slice(3, 5), 16);
  const fgB = parseInt(fg.slice(5, 7), 16);
  const bgR = parseInt(bg.slice(1, 3), 16);
  const bgG = parseInt(bg.slice(3, 5), 16);
  const bgB = parseInt(bg.slice(5, 7), 16);
  const r = Math.round(fgR * fgOpacity + bgR * (1 - fgOpacity));
  const g = Math.round(fgG * fgOpacity + bgG * (1 - fgOpacity));
  const b = Math.round(fgB * fgOpacity + bgB * (1 - fgOpacity));
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Returns true if the given hex color has high perceived luminance (i.e. is "light").
 * Useful for choosing between dark/light foreground text.
 */
export const isLightColor = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
};
