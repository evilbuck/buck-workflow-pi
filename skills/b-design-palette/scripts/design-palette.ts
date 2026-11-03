#!/usr/bin/env bun
/**
 * Deterministic UI design palette → design-brief.jsonc
 *
 *   bun skills/b-design-palette/scripts/design-palette.ts --brand '#3366ff' --stdout
 *   bun skills/b-design-palette/scripts/design-palette.ts --brand '#3366ff' --out design-brief.jsonc
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { emitDesignBriefJsonc } from "./emit-jsonc.js";
import {
  NEUTRALS,
  SCHEMES,
  buildPalette,
  type NeutralTemp,
  type PaletteInputs,
  type Scheme,
} from "./palette-build.js";

export type CliArgs = PaletteInputs & { out: string; stdout: boolean; help: boolean };

function die(message: string, code = 1): never {
  console.error(`design-palette: error: ${message}`);
  process.exit(code);
}

function usage(): string {
  return `Usage: design-palette --brand <#hex> [options]

Required:
  --brand <#hex>              Brand / primary color

Optional:
  --secondary <#hex>          Override secondary
  --accent <#hex>             Override accent
  --scheme <name>             complementary | triadic | analogous | split-complementary (default: complementary)
  --neutral <temp>            warm | cool | pure (default: cool)
  --status-success <#hex>
  --status-warning <#hex>
  --status-error <#hex>
  --status-info <#hex>
  --dark / --no-dark          Include dark role mapping (default: --dark)
  --name <string>             UI name in meta
  --purpose <string>
  --audience <string>
  --out <path>                Write JSONC (default: design-brief.jsonc)
  --stdout                    Print JSONC to stdout instead of writing a file
  --help                      Show this help
`;
}

function takeValue(argv: string[], i: number, flag: string): [string, number] {
  const value = argv[i + 1];
  if (!value || value.startsWith("--")) die(`missing value for ${flag}`);
  return [value, i + 1];
}

function setStringField(
  result: CliArgs,
  field: "brand" | "secondary" | "accent" | "name" | "purpose" | "audience" | "out",
  argv: string[],
  i: number,
  flag: string,
): number {
  const [value, next] = takeValue(argv, i, flag);
  result[field] = value;
  return next;
}

function setStatus(
  result: CliArgs,
  key: "success" | "warning" | "error" | "info",
  argv: string[],
  i: number,
  flag: string,
): number {
  const [value, next] = takeValue(argv, i, flag);
  result.status = { ...result.status, [key]: value };
  return next;
}

function setScheme(result: CliArgs, argv: string[], i: number): number {
  const [value, next] = takeValue(argv, i, "--scheme");
  if (!SCHEMES.includes(value as Scheme)) die(`unknown scheme: ${value}`);
  result.scheme = value as Scheme;
  return next;
}

function setNeutral(result: CliArgs, argv: string[], i: number): number {
  const [value, next] = takeValue(argv, i, "--neutral");
  if (!NEUTRALS.includes(value as NeutralTemp)) die(`unknown neutral: ${value}`);
  result.neutral = value as NeutralTemp;
  return next;
}

type FlagHandler = (result: CliArgs, argv: string[], i: number) => number;

const FLAG_HANDLERS: Record<string, FlagHandler> = {
  "--help": (result) => {
    result.help = true;
    return -1;
  },
  "-h": (result) => {
    result.help = true;
    return -1;
  },
  "--stdout": (result) => {
    result.stdout = true;
    return -1;
  },
  "--dark": (result) => {
    result.dark = true;
    return -1;
  },
  "--no-dark": (result) => {
    result.dark = false;
    return -1;
  },
  "--brand": (result, argv, i) => setStringField(result, "brand", argv, i, "--brand"),
  "--secondary": (result, argv, i) => setStringField(result, "secondary", argv, i, "--secondary"),
  "--accent": (result, argv, i) => setStringField(result, "accent", argv, i, "--accent"),
  "--scheme": (result, argv, i) => setScheme(result, argv, i),
  "--neutral": (result, argv, i) => setNeutral(result, argv, i),
  "--status-success": (result, argv, i) => setStatus(result, "success", argv, i, "--status-success"),
  "--status-warning": (result, argv, i) => setStatus(result, "warning", argv, i, "--status-warning"),
  "--status-error": (result, argv, i) => setStatus(result, "error", argv, i, "--status-error"),
  "--status-info": (result, argv, i) => setStatus(result, "info", argv, i, "--status-info"),
  "--name": (result, argv, i) => setStringField(result, "name", argv, i, "--name"),
  "--purpose": (result, argv, i) => setStringField(result, "purpose", argv, i, "--purpose"),
  "--audience": (result, argv, i) => setStringField(result, "audience", argv, i, "--audience"),
  "--out": (result, argv, i) => setStringField(result, "out", argv, i, "--out"),
};

function defaultArgs(): CliArgs {
  return {
    brand: "",
    scheme: "complementary",
    neutral: "cool",
    dark: true,
    out: "design-brief.jsonc",
    stdout: false,
    help: false,
    status: {},
  };
}

export function parseArgs(argv: string[]): CliArgs {
  const result = defaultArgs();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const handler = FLAG_HANDLERS[arg];
    if (!handler) die(`unknown argument: ${arg}`);
    const next = handler(result, argv, i);
    if (next >= 0) i = next;
  }
  return result;
}

export function run(argv: string[]): string {
  const args = parseArgs(argv);
  if (args.help) return usage();
  if (!args.brand) die("--brand is required");
  return emitDesignBriefJsonc(buildPalette(args));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.brand) die("--brand is required");
  const text = run(process.argv.slice(2));
  if (args.stdout) {
    process.stdout.write(text);
    return;
  }
  const path = resolve(args.out);
  writeFileSync(path, text, "utf8");
  console.error(`design-palette: wrote ${path}`);
}

if (import.meta.main) main();
