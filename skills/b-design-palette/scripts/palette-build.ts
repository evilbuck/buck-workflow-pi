import {
  contrastRatio,
  hexToOklch,
  normalizeHex,
  oklchToHexGamutMapped,
  pickOnColor,
  rotateHue,
  type Oklch,
} from "./color-math.js";

export type Scheme =
  | "complementary"
  | "triadic"
  | "analogous"
  | "split-complementary";

export type NeutralTemp = "warm" | "cool" | "pure";

export interface PaletteInputs {
  brand: string;
  secondary?: string;
  accent?: string;
  scheme: Scheme;
  neutral: NeutralTemp;
  status?: Partial<Record<"success" | "warning" | "error" | "info", string>>;
  dark: boolean;
  name?: string;
  purpose?: string;
  audience?: string;
}

export type TintScale = Record<string, string>;

export interface ContrastEntry {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  pass_aa: boolean;
}

export interface DesignBriefDoc {
  name: string;
  version: number;
  meta: {
    purpose?: string;
    audience?: string;
    generated_by: string;
  };
  inputs: {
    brand: string;
    secondary: string | null;
    accent: string | null;
    scheme: Scheme;
    neutral: NeutralTemp;
    dark: boolean;
    status_overrides: Record<string, string>;
  };
  scales: {
    brand: TintScale;
    neutral: TintScale;
    success: TintScale;
    warning: TintScale;
    error: TintScale;
    info: TintScale;
    secondary: TintScale;
    accent: TintScale;
  };
  roles: {
    light: Record<string, string>;
    dark?: Record<string, string>;
  };
  contrast: ContrastEntry[];
}

const TINT_KEYS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;

/** Target lightness for each Tailwind-like step (OKLCH L). */
const TINT_L: Record<(typeof TINT_KEYS)[number], number> = {
  "50": 0.97,
  "100": 0.93,
  "200": 0.87,
  "300": 0.8,
  "400": 0.72,
  "500": 0.62,
  "600": 0.54,
  "700": 0.46,
  "800": 0.38,
  "900": 0.3,
  "950": 0.22,
};

const STATUS_HUE: Record<"success" | "warning" | "error" | "info", number> = {
  success: 145,
  warning: 85,
  error: 25,
  info: 250,
};

const NEUTRAL_HUE: Record<NeutralTemp, number> = {
  warm: 70,
  cool: 250,
  pure: 0,
};

export function buildTintScale(base: Oklch, chromaScale = 1): TintScale {
  const scale: TintScale = {};
  for (const key of TINT_KEYS) {
    const L = TINT_L[key];
    // Softer chroma at extremes so light tints and deep shades stay in gamut.
    const edge = Math.min(L, 1 - L);
    const C = base.C * chromaScale * Math.min(1, edge / 0.25);
    scale[key] = oklchToHexGamutMapped({ L, C, H: base.H });
  }
  return scale;
}

function schemeHues(brandH: number, scheme: Scheme): { secondary: number; accent: number } {
  switch (scheme) {
    case "complementary":
      return { secondary: rotateHue(brandH, 180), accent: rotateHue(brandH, 30) };
    case "triadic":
      return { secondary: rotateHue(brandH, 120), accent: rotateHue(brandH, 240) };
    case "analogous":
      return { secondary: rotateHue(brandH, 30), accent: rotateHue(brandH, -30) };
    case "split-complementary":
      return { secondary: rotateHue(brandH, 150), accent: rotateHue(brandH, 210) };
  }
}

function buildNeutralScale(brand: Oklch, temp: NeutralTemp): TintScale {
  const H = NEUTRAL_HUE[temp];
  const C = temp === "pure" ? 0 : Math.min(0.02, brand.C * 0.15);
  return buildTintScale({ L: brand.L, C, H }, 1);
}

function buildStatusScale(
  brand: Oklch,
  kind: keyof typeof STATUS_HUE,
  override?: string,
): TintScale {
  if (override) return buildTintScale(hexToOklch(normalizeHex(override)));
  return buildTintScale({
    L: brand.L,
    C: Math.max(0.08, Math.min(brand.C, 0.16)),
    H: STATUS_HUE[kind],
  });
}

function pickStep(scale: TintScale, lightKey: string, darkKey: string, isLight: boolean): string {
  return isLight ? scale[lightKey] : scale[darkKey];
}

function surfaceRoles(neutral: TintScale, isLight: boolean): Record<string, string> {
  return {
    background: pickStep(neutral, "50", "950", isLight),
    surface: isLight ? "#ffffff" : neutral["900"],
    border: pickStep(neutral, "200", "700", isLight),
    text: pickStep(neutral, "900", "50", isLight),
    textMuted: pickStep(neutral, "600", "400", isLight),
    textDisabled: pickStep(neutral, "400", "600", isLight),
  };
}

function fillWithOn(fill: string): { fill: string; on: string } {
  return { fill, on: pickOnColor(fill) };
}

function brandRoles(brand: TintScale, isLight: boolean): Record<string, string> {
  const primary = pickStep(brand, "600", "400", isLight);
  return {
    primary,
    onPrimary: pickOnColor(primary),
    primaryHover: pickStep(brand, "700", "300", isLight),
    primaryActive: pickStep(brand, "800", "200", isLight),
    primarySelected: pickStep(brand, "100", "800", isLight),
    primaryDisabled: pickStep(brand, "200", "800", isLight),
    focusRing: pickStep(brand, "500", "300", isLight),
  };
}

function namedFillRoles(
  secondary: TintScale,
  accent: TintScale,
  success: TintScale,
  warning: TintScale,
  error: TintScale,
  info: TintScale,
  isLight: boolean,
): Record<string, string> {
  const secondaryFill = fillWithOn(pickStep(secondary, "600", "400", isLight));
  const accentFill = fillWithOn(pickStep(accent, "500", "400", isLight));
  const successFill = fillWithOn(pickStep(success, "600", "400", isLight));
  const warningFill = fillWithOn(pickStep(warning, "600", "400", isLight));
  const errorFill = fillWithOn(pickStep(error, "600", "400", isLight));
  const infoFill = fillWithOn(pickStep(info, "600", "400", isLight));
  return {
    secondary: secondaryFill.fill,
    onSecondary: secondaryFill.on,
    accent: accentFill.fill,
    onAccent: accentFill.on,
    success: successFill.fill,
    onSuccess: successFill.on,
    warning: warningFill.fill,
    onWarning: warningFill.on,
    error: errorFill.fill,
    onError: errorFill.on,
    info: infoFill.fill,
    onInfo: infoFill.on,
  };
}

function roleSet(
  brand: TintScale,
  neutral: TintScale,
  success: TintScale,
  warning: TintScale,
  error: TintScale,
  info: TintScale,
  secondary: TintScale,
  accent: TintScale,
  mode: "light" | "dark",
): Record<string, string> {
  const isLight = mode === "light";
  return {
    ...surfaceRoles(neutral, isLight),
    ...brandRoles(brand, isLight),
    ...namedFillRoles(secondary, accent, success, warning, error, info, isLight),
  };
}

function contrastPairs(roles: Record<string, string>, mode: string): ContrastEntry[] {
  const pairs: Array<[string, string, string]> = [
    ["text/background", "text", "background"],
    ["textMuted/background", "textMuted", "background"],
    ["onPrimary/primary", "onPrimary", "primary"],
    ["onSecondary/secondary", "onSecondary", "secondary"],
    ["onAccent/accent", "onAccent", "accent"],
    ["onSuccess/success", "onSuccess", "success"],
    ["onWarning/warning", "onWarning", "warning"],
    ["onError/error", "onError", "error"],
    ["onInfo/info", "onInfo", "info"],
  ];
  return pairs.map(([label, fgKey, bgKey]) => {
    const foreground = roles[fgKey];
    const background = roles[bgKey];
    const ratio = Number(contrastRatio(foreground, background).toFixed(2));
    return {
      pair: `${mode}:${label}`,
      foreground,
      background,
      ratio,
      pass_aa: ratio >= 4.5,
    };
  });
}

function resolveCompanion(brand: Oklch, override: string | undefined, H: number, chromaMul: number): Oklch {
  if (override) return hexToOklch(normalizeHex(override));
  return { L: brand.L, C: brand.C * chromaMul, H };
}

function buildAllScales(raw: PaletteInputs, brand: Oklch): DesignBriefDoc["scales"] {
  const hues = schemeHues(brand.H, raw.scheme);
  const secondaryBase = resolveCompanion(brand, raw.secondary, hues.secondary, 0.9);
  const accentBase = resolveCompanion(brand, raw.accent, hues.accent, 0.85);
  return {
    brand: buildTintScale(brand),
    neutral: buildNeutralScale(brand, raw.neutral),
    success: buildStatusScale(brand, "success", raw.status?.success),
    warning: buildStatusScale(brand, "warning", raw.status?.warning),
    error: buildStatusScale(brand, "error", raw.status?.error),
    info: buildStatusScale(brand, "info", raw.status?.info),
    secondary: buildTintScale(secondaryBase),
    accent: buildTintScale(accentBase),
  };
}

function rolesFromScales(scales: DesignBriefDoc["scales"], dark: boolean): {
  roles: DesignBriefDoc["roles"];
  contrast: ContrastEntry[];
} {
  const light = roleSet(
    scales.brand, scales.neutral, scales.success, scales.warning,
    scales.error, scales.info, scales.secondary, scales.accent, "light",
  );
  const roles: DesignBriefDoc["roles"] = { light };
  const contrast = contrastPairs(light, "light");
  if (dark) {
    const darkRoles = roleSet(
      scales.brand, scales.neutral, scales.success, scales.warning,
      scales.error, scales.info, scales.secondary, scales.accent, "dark",
    );
    roles.dark = darkRoles;
    contrast.push(...contrastPairs(darkRoles, "dark"));
  }
  return { roles, contrast };
}

function statusOverrides(raw: PaletteInputs): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw.status) return out;
  for (const [k, v] of Object.entries(raw.status)) {
    if (v) out[k] = normalizeHex(v);
  }
  return out;
}

function assertPrimaryContrast(contrast: ContrastEntry[]): void {
  const failing = contrast.filter((c) => !c.pass_aa && c.pair.includes("onPrimary"));
  if (failing.length > 0) {
    throw new Error(`WCAG AA failed for primary pairs: ${failing.map((f) => f.pair).join(", ")}`);
  }
}

export function buildPalette(raw: PaletteInputs): DesignBriefDoc {
  const brandHex = normalizeHex(raw.brand);
  const brand = hexToOklch(brandHex);
  const scales = buildAllScales(raw, brand);
  const { roles, contrast } = rolesFromScales(scales, raw.dark);
  assertPrimaryContrast(contrast);
  return {
    name: raw.name?.trim() || "ui-palette",
    version: 1,
    meta: {
      purpose: raw.purpose,
      audience: raw.audience,
      generated_by: "b-design-palette",
    },
    inputs: {
      brand: brandHex,
      secondary: raw.secondary ? normalizeHex(raw.secondary) : null,
      accent: raw.accent ? normalizeHex(raw.accent) : null,
      scheme: raw.scheme,
      neutral: raw.neutral,
      dark: raw.dark,
      status_overrides: statusOverrides(raw),
    },
    scales,
    roles,
    contrast,
  };
}

export const SCHEMES: Scheme[] = [
  "complementary",
  "triadic",
  "analogous",
  "split-complementary",
];

export const NEUTRALS: NeutralTemp[] = ["warm", "cool", "pure"];
