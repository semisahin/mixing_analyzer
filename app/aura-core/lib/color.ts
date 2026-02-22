// app/aura-core/lib/color.ts
import type { Rgb, Theme } from "./types";

/**
 * Aura Core Accent Policy (Preset-only, Theme-specific)
 * - Dark mode: white + colors (NO black)
 * - Light mode: black + colors (NO white)
 * - No contrast validation. Only presets.
 */

// Required defaults
export const DEFAULT_THEME: Theme = "dark";
export const THEME_ACCENT_DARK_DEFAULT = "#ffffff" as const;
export const THEME_ACCENT_LIGHT_DEFAULT = "#000000" as const;
export const DEFAULT_ACCENT = THEME_ACCENT_DARK_DEFAULT;

// Shared palette (your requested colors)
export const ACCENT_COLORS = [
  "#ef4444", // red
  "#22c55e", // green
  "#eab308", // yellow
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan / turquoise
  "#f97316", // orange (optional but nice)
] as const;

// Theme presets
export const ACCENT_PRESETS_DARK = [THEME_ACCENT_DARK_DEFAULT, ...ACCENT_COLORS] as const;
export const ACCENT_PRESETS_LIGHT = [THEME_ACCENT_LIGHT_DEFAULT, ...ACCENT_COLORS] as const;

export type AccentPreset =
  | (typeof ACCENT_PRESETS_DARK)[number]
  | (typeof ACCENT_PRESETS_LIGHT)[number];

// ---- Helpers ----
export function getThemeAccent(theme: Theme) {
  // "Default accent for theme"
  return theme === "dark" ? THEME_ACCENT_DARK_DEFAULT : THEME_ACCENT_LIGHT_DEFAULT;
}

export function getThemeAccents(theme: Theme): readonly string[] {
  return theme === "dark" ? ACCENT_PRESETS_DARK : ACCENT_PRESETS_LIGHT;
}

export function normalizeHex(input: string) {
  let v = input.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (v.length === 4) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v.toLowerCase();
}

export function isValidHex6(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v);
}

export function hexToRgb(hex: string): Rgb | null {
  const v = normalizeHex(hex);
  if (!isValidHex6(v)) return null;
  const r = parseInt(v.slice(1, 3), 16);
  const g = parseInt(v.slice(3, 5), 16);
  const b = parseInt(v.slice(5, 7), 16);
  return { r, g, b };
}

export function rgbToCssVar(rgb: Rgb) {
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

// Preset-only gate (per theme)
export function isAllowedAccent(hex: string, theme: Theme) {
  const v = normalizeHex(hex);
  return getThemeAccents(theme).includes(v);
}