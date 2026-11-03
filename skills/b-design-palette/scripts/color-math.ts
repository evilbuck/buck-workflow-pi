/**
 * Deterministic sRGB ↔ OKLab/OKLCH helpers and WCAG contrast.
 * OKLab matrices follow Björn Ottosson (https://bottosson.github.io/posts/oklab/).
 */

export type Rgb = { r: number; g: number; b: number }; // 0..1
export type Oklab = { L: number; a: number; b: number };
export type Oklch = { L: number; C: number; H: number }; // H in degrees [0, 360)

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function parseHex(input: string): Rgb {
  const m = HEX_RE.exec(input.trim());
  if (!m) throw new Error(`invalid hex color: ${input}`);
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const byte = (x: number) => Math.round(clamp(x) * 255).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToRgb({ L, a, b }: Oklab): Rgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lb),
  };
}

export function oklabToOklch({ L, a, b }: Oklab): Oklch {
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

export function oklchToOklab({ L, C, H }: Oklch): Oklab {
  const rad = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

export function hexToOklch(hex: string): Oklch {
  return oklabToOklch(rgbToOklab(parseHex(hex)));
}

export function isInGamut(rgb: Rgb, eps = 1e-4): boolean {
  return (
    rgb.r >= -eps && rgb.r <= 1 + eps &&
    rgb.g >= -eps && rgb.g <= 1 + eps &&
    rgb.b >= -eps && rgb.b <= 1 + eps
  );
}

/** Reduce chroma until the color fits sRGB; returns hex. */
export function oklchToHexGamutMapped(color: Oklch): string {
  let lo = 0;
  let hi = color.C;
  let best = { ...color, C: 0 };
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const candidate = { L: color.L, C: mid, H: color.H };
    const rgb = oklabToRgb(oklchToOklab(candidate));
    if (isInGamut(rgb)) {
      best = candidate;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const rgb = oklabToRgb(oklchToOklab(best));
  return toHex({
    r: Math.min(1, Math.max(0, rgb.r)),
    g: Math.min(1, Math.max(0, rgb.g)),
    b: Math.min(1, Math.max(0, rgb.b)),
  });
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Choose an "on" color that meets WCAG AA (≥4.5) against fill. */
export function pickOnColor(fillHex: string, candidates: string[] = ["#ffffff", "#0a0a0a"]): string {
  let best = candidates[0];
  let bestRatio = 0;
  for (const c of candidates) {
    const ratio = contrastRatio(c, fillHex);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = c;
    }
  }
  if (bestRatio < 4.5) {
    // Nudge toward pure black/white by evaluating both extremes again with report.
    const white = contrastRatio("#ffffff", fillHex);
    const black = contrastRatio("#000000", fillHex);
    best = white >= black ? "#ffffff" : "#000000";
  }
  return best;
}

export function rotateHue(H: number, delta: number): number {
  let next = (H + delta) % 360;
  if (next < 0) next += 360;
  return next;
}

export function normalizeHex(input: string): string {
  return toHex(parseHex(input));
}
