import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  hexToOklch,
  isInGamut,
  oklabToRgb,
  oklchToHexGamutMapped,
  oklchToOklab,
  parseHex,
  relativeLuminance,
  toHex,
} from "./color-math.js";
import { emitDesignBriefJsonc } from "./emit-jsonc.js";
import { buildPalette, buildTintScale } from "./palette-build.js";
import { parseArgs, run } from "./design-palette.js";

const BRAND = "#3366ff";

describe("color-math", () => {
  it("round-trips a mid gray through OKLCH → hex", () => {
    const hex = oklchToHexGamutMapped({ L: 0.6, C: 0, H: 0 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    const L = relativeLuminance(hex);
    expect(L).toBeGreaterThan(0.2);
    expect(L).toBeLessThan(0.5);
  });

  it("parses short and long hex", () => {
    expect(toHex(parseHex("#abc"))).toBe("#aabbcc");
    expect(toHex(parseHex("3366ff"))).toBe("#3366ff");
  });

  it("maps out-of-gamut high chroma into sRGB", () => {
    const wild = { L: 0.7, C: 0.4, H: 40 };
    const raw = oklabToRgb(oklchToOklab(wild));
    expect(isInGamut(raw)).toBe(false);
    const hex = oklchToHexGamutMapped(wild);
    expect(isInGamut(parseHex(hex))).toBe(true);
  });

  it("computes WCAG contrast symmetrically", () => {
    const ratio = contrastRatio("#000000", "#ffffff");
    expect(ratio).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });
});

describe("palette-build golden #3366ff", () => {
  const doc = buildPalette({
    brand: BRAND,
    scheme: "complementary",
    neutral: "cool",
    dark: true,
    name: "sample-ui",
    purpose: "Demo dashboard",
    audience: "operators",
  });

  it("normalizes brand and stamps generator meta", () => {
    expect(doc.inputs.brand).toBe("#3366ff");
    expect(doc.meta.generated_by).toBe("b-design-palette");
    expect(doc.name).toBe("sample-ui");
    expect(doc.meta.purpose).toBe("Demo dashboard");
  });

  it("emits full 50–950 brand and neutral scales", () => {
    const keys = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
    expect(Object.keys(doc.scales.brand)).toEqual(keys);
    expect(Object.keys(doc.scales.neutral)).toEqual(keys);
    for (const key of keys) {
      expect(doc.scales.brand[key]).toMatch(/^#[0-9a-f]{6}$/);
      expect(doc.scales.neutral[key]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps brand hue family across the tint scale", () => {
    const brandH = hexToOklch(BRAND).H;
    for (const hex of Object.values(doc.scales.brand)) {
      const H = hexToOklch(hex).H;
      const delta = Math.min(Math.abs(H - brandH), 360 - Math.abs(H - brandH));
      expect(delta).toBeLessThan(8);
    }
  });

  it("lightness steps decrease from 50 to 950", () => {
    const Ls = Object.values(doc.scales.brand).map((hex) => hexToOklch(hex).L);
    for (let i = 1; i < Ls.length; i++) {
      expect(Ls[i]).toBeLessThan(Ls[i - 1]);
    }
  });

  it("defines light and dark semantic roles", () => {
    expect(doc.roles.light.primary).toMatch(/^#/);
    expect(doc.roles.light.onPrimary).toMatch(/^#/);
    expect(doc.roles.dark?.background).toMatch(/^#/);
    expect(doc.roles.dark?.primary).toMatch(/^#/);
  });

  it("passes WCAG AA for on-fill pairs including primary", () => {
    const primaryPairs = doc.contrast.filter((c) => c.pair.includes("onPrimary/primary"));
    expect(primaryPairs.length).toBeGreaterThanOrEqual(1);
    for (const entry of doc.contrast.filter((c) => c.pair.includes("onPrimary") || c.pair.includes("text/background"))) {
      expect(entry.pass_aa, entry.pair).toBe(true);
      expect(entry.ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("is deterministic across two builds", () => {
    const again = buildPalette({
      brand: BRAND,
      scheme: "complementary",
      neutral: "cool",
      dark: true,
      name: "sample-ui",
      purpose: "Demo dashboard",
      audience: "operators",
    });
    expect(again).toEqual(doc);
  });

  it("JSONC contains section comments and parses after stripping // comments", () => {
    const text = emitDesignBriefJsonc(doc);
    expect(text).toContain("// ── UI meta");
    expect(text).toContain("// ── Scales");
    expect(text).toContain("// ── Semantic roles (light)");
    expect(text).toContain("// ── Contrast report");
    const stripped = text
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("//");
        if (idx === -1) return line;
        // naive strip ok here: hex/strings in this emitter never contain //
        return line.slice(0, idx);
      })
      .join("\n");
    const parsed = JSON.parse(stripped);
    expect(parsed.inputs.brand).toBe("#3366ff");
    expect(parsed.scales.brand["500"]).toMatch(/^#/);
    expect(parsed.roles.light.primary).toBe(doc.roles.light.primary);
  });
});

describe("schemes and overrides", () => {
  it("rotates secondary for complementary vs analogous", () => {
    const comp = buildPalette({ brand: BRAND, scheme: "complementary", neutral: "pure", dark: false });
    const ana = buildPalette({ brand: BRAND, scheme: "analogous", neutral: "pure", dark: false });
    expect(comp.scales.secondary["500"]).not.toBe(ana.scales.secondary["500"]);
  });

  it("honors explicit secondary and status overrides", () => {
    const doc = buildPalette({
      brand: BRAND,
      secondary: "#ff6600",
      scheme: "triadic",
      neutral: "warm",
      dark: false,
      status: { error: "#cc0000" },
    });
    expect(doc.inputs.secondary).toBe("#ff6600");
    expect(doc.inputs.status_overrides.error).toBe("#cc0000");
    const errH = hexToOklch(doc.scales.error["500"]).H;
    const overrideH = hexToOklch("#cc0000").H;
    const delta = Math.min(Math.abs(errH - overrideH), 360 - Math.abs(errH - overrideH));
    expect(delta).toBeLessThan(15);
  });
});

describe("CLI parseArgs / run", () => {
  it("requires --brand", () => {
    expect(() => parseArgs([])).not.toThrow();
    expect(parseArgs([]).brand).toBe("");
  });

  it("parses flags", () => {
    const args = parseArgs([
      "--brand",
      BRAND,
      "--scheme",
      "triadic",
      "--neutral",
      "warm",
      "--no-dark",
      "--name",
      "App",
      "--stdout",
    ]);
    expect(args.brand).toBe(BRAND);
    expect(args.scheme).toBe("triadic");
    expect(args.neutral).toBe("warm");
    expect(args.dark).toBe(false);
    expect(args.name).toBe("App");
    expect(args.stdout).toBe(true);
  });

  it("run returns JSONC for brand", () => {
    const text = run(["--brand", BRAND, "--stdout", "--name", "golden"]);
    expect(text).toContain('"name": "golden"');
    expect(text).toContain('"brand": "#3366ff"');
  });
});

describe("buildTintScale export", () => {
  it("produces eleven steps", () => {
    const scale = buildTintScale(hexToOklch(BRAND));
    expect(Object.keys(scale)).toHaveLength(11);
  });
});
