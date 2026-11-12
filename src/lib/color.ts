/**
 * Color utilities: WCAG contrast and automatic adjustment of member colors so
 * that colored lyric TEXT stays readable on both the light and dark backgrounds.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const LIGHT_BG = '#ffffff';
export const DARK_BG = '#0b0f14';

/** WCAG AA for normal body text. Lyrics (17–18px) and member names (13px) both use this. */
export const MIN_TEXT_CONTRAST = 4.5;

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: RGB): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

/**
 * Returns `color` unchanged when it already meets `minRatio` against `bg`;
 * otherwise darkens (on light backgrounds) or lightens (on dark backgrounds)
 * the color step by step, keeping hue and saturation, until it does.
 */
export function ensureContrast(color: string, bg: string, minRatio = MIN_TEXT_CONTRAST): string {
  const fg = parseHex(color);
  const bgRgb = parseHex(bg);
  if (!fg || !bgRgb) return color;
  if (contrastRatio(fg, bgRgb) >= minRatio) return toHex(fg);

  const bgIsLight = relativeLuminance(bgRgb) > 0.4;
  const hsl = rgbToHsl(fg);
  const step = bgIsLight ? -0.02 : 0.02;
  let l = hsl.l;
  for (let i = 0; i < 60; i += 1) {
    l = Math.max(0, Math.min(1, l + step));
    const candidate = hslToRgb({ h: hsl.h, s: hsl.s, l });
    if (contrastRatio(candidate, bgRgb) >= minRatio) return toHex(candidate);
    if (l <= 0 || l >= 1) break;
  }
  // Extremely saturated hues (e.g. pure yellow) may still fall short at the
  // lightness limit; desaturate slightly as a last resort.
  let s = hsl.s;
  for (let i = 0; i < 20; i += 1) {
    s = Math.max(0, s - 0.05);
    const candidate = hslToRgb({ h: hsl.h, s, l });
    if (contrastRatio(candidate, bgRgb) >= minRatio) return toHex(candidate);
  }
  return bgIsLight ? '#111827' : '#f3f4f6';
}

export interface ThemedColor {
  /** Original color as written in the content. */
  source: string;
  /** Adjusted for the light background. */
  light: string;
  /** Adjusted for the dark background. */
  dark: string;
  lightRatio: number;
  darkRatio: number;
}

export function themedColor(color: string): ThemedColor {
  const light = ensureContrast(color, LIGHT_BG);
  const dark = ensureContrast(color, DARK_BG);
  const lightRgb = parseHex(light);
  const darkRgb = parseHex(dark);
  const lightBg = parseHex(LIGHT_BG)!;
  const darkBg = parseHex(DARK_BG)!;
  return {
    source: color,
    light,
    dark,
    lightRatio: lightRgb ? contrastRatio(lightRgb, lightBg) : 0,
    darkRatio: darkRgb ? contrastRatio(darkRgb, darkBg) : 0,
  };
}

/**
 * Builds a CSS gradient that moves through each member color with short
 * blends between mostly-solid segments, so most characters keep a solid,
 * readable color.
 */
export function segmentedGradient(colors: string[]): string {
  if (colors.length === 0) return 'none';
  if (colors.length === 1) return `linear-gradient(90deg, ${colors[0]}, ${colors[0]})`;
  const n = colors.length;
  const width = 100 / n;
  const blend = Math.min(6, width / 4);
  const stops: string[] = [];
  colors.forEach((color, i) => {
    const start = i * width;
    const end = (i + 1) * width;
    const from = i === 0 ? 0 : start + blend;
    const to = i === n - 1 ? 100 : end - blend;
    stops.push(`${color} ${from.toFixed(1)}%`, `${color} ${to.toFixed(1)}%`);
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
