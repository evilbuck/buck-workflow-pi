// pack.ts — pack N self-contained tabbed HTML reports into one Chrome/file:// file.
//   bun pack.ts --dir DIR
//   bun pack.ts --config PATH
// Shebang is intentionally omitted so `bun pack.ts` resolves through PATH.
//
// Usage:
//   bun pack.ts --dir DIR            # load DIR/pack.config.mjs, falling back to
//                                    # DIR/pack.config.ts (default: cwd)
//   bun pack.ts --config PATH        # load PATH (any .mjs/.ts/.js module); outDir
//                                    # = dirname(config)
//
// Existing user `pack.config.mjs` files keep loading unchanged; the .ts fallback
// only applies when no .mjs config exists in the directory.
//
// The skill owns assets/extra.css and assets/app.ts. Config paths (`out`, `index`,
// each report `file`) resolve relative to the directory that contains the config.
//
// Sibling of markdown-docs-to-tabbed-html: that skill *builds* a tabbed doc-app;
// this skill *packs* two or more same-shape reports into one file because merging
// 11 tabs overflows the strip.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, resolve, basename, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Shape of one entry in `pack.config.*` → `reports[]`. */
export interface PackReport {
  key: string;
  file: string;
  label: string;
  title: string;
  /** Switcher tone; defaults to "primary" when absent or falsy. */
  tone?: string;
}

/** Validated shape of the default export of a `pack.config.*` module. */
export interface PackConfig {
  out: string;
  brand: string;
  /** Optional index.html whose KB chip is refreshed; null when unused. */
  index: string | null;
  reports: PackReport[];
}

function bail(msg: string, code = 1): never {
  console.error(`pack.ts: ${msg}`);
  process.exit(code);
}

// ---- args ----
const argv: string[] = process.argv.slice(2);
let cfgPath: string | null = null;
let dirArg: string | null = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--config") {
    const v = argv[++i];
    if (v === undefined) bail(`missing value for --config (usage: bun pack.ts [--dir DIR | --config PATH])`, 2);
    cfgPath = resolve(v);
  }
  else if (a === "--dir") {
    const v = argv[++i];
    if (v === undefined) bail(`missing value for --dir (usage: bun pack.ts [--dir DIR | --config PATH])`, 2);
    dirArg = resolve(v);
  }
  else if (a === "--help" || a === "-h") {
    console.log("bun pack.ts [--dir DIR | --config PATH]");
    process.exit(0);
  } else {
    bail(`unknown arg: ${a}`, 2);
  }
}
if (!cfgPath) {
  if (!dirArg) dirArg = process.cwd();
  // Legacy .mjs configs win; the .ts fallback only applies when no .mjs exists.
  const legacyPath = resolve(dirArg, "pack.config.mjs");
  const tsPath = resolve(dirArg, "pack.config.ts");
  cfgPath = existsSync(legacyPath) ? legacyPath : tsPath;
  if (!existsSync(cfgPath)) bail(`config not found: ${legacyPath} (also tried ${tsPath})`, 2);
}

const outDir = dirname(cfgPath);
const __dirname = dirname(fileURLToPath(import.meta.url));
const extraCssPath = resolve(__dirname, "../assets/extra.css");
const appTsPath = resolve(__dirname, "../assets/app.ts");

if (!existsSync(cfgPath)) bail(`config not found: ${cfgPath}`, 2);
if (!existsSync(extraCssPath)) bail(`skill asset missing: ${extraCssPath}`, 2);
if (!existsSync(appTsPath)) bail(`skill asset missing: ${appTsPath}`, 2);

// ---- helpers ----
function read(p: string): string { return readFileSync(p, "utf8"); }
function existsSync(p: string): boolean { try { statSync(p); return true; } catch { return false; } }

function isObjectLike(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Runtime predicate mirroring the legacy key/file/label/title presence check. */
function isPackReport(v: unknown): v is PackReport {
  if (!isObjectLike(v)) return false;
  return typeof v.key === "string" && v.key !== ""
    && typeof v.file === "string" && v.file !== ""
    && typeof v.label === "string" && v.label !== ""
    && typeof v.title === "string" && v.title !== "";
}

/** Validate the report list before writing any output. */
function parseReports(rawReports: unknown, outDir: string): PackReport[] {
  if (!Array.isArray(rawReports) || rawReports.length < 2) {
    bail("pack.config.mjs must list at least two reports", 2);
  }
  const seenKeys = new Set<string>();
  const reports: PackReport[] = [];
  for (const entry of rawReports) {
    if (!isPackReport(entry)) {
      bail(`report missing key/file/label/title: ${JSON.stringify(entry)}`, 2);
    }
    if (seenKeys.has(entry.key)) bail(`duplicate report key: ${entry.key}`, 2);
    seenKeys.add(entry.key);
    const fp = resolve(outDir, entry.file);
    if (!existsSync(fp)) bail(`report file missing: ${entry.file}`, 2);
    reports.push(entry);
  }
  return reports;
}

/** Validate the config, preserving error order and default tone behavior. */
function parseConfig(raw: unknown, cfgPath: string, outDir: string): PackConfig {
  if (!isObjectLike(raw)) bail(`config did not export default: ${cfgPath}`, 2);
  if (typeof raw.out !== "string" || raw.out === "") bail(`config must set "out" (output filename): ${cfgPath}`, 2);
  if (typeof raw.brand !== "string") bail(`config must set "brand": ${cfgPath}`, 2);
  const index = typeof raw.index === "string" ? raw.index : null;
  const reports = parseReports(raw.reports, outDir);
  return { out: raw.out, brand: raw.brand, index, reports };
}

/** Extract the `default` export from a dynamically imported module. */
function defaultExportOf(mod: unknown, cfgPath: string): unknown {
  if (!isObjectLike(mod) || !("default" in mod)) bail(`config did not export default: ${cfgPath}`, 2);
  return mod.default;
}

interface BunTranspiler {
  transformSync(code: string): string;
}
interface BunGlobal {
  Transpiler?: new (options: { loader: string }) => BunTranspiler;
}

/** Resolve Bun's TS transpiler; the packed script always runs under Bun. */
function bunTranspiler(): BunTranspiler {
  // `Bun` is a Bun-runtime global; @types/bun is not installed in this repo, so
  // the global surface is declared structurally here.
  const bunGlobal = globalThis as { Bun?: BunGlobal };
  if (!bunGlobal.Bun || !bunGlobal.Bun.Transpiler) bail("Bun.Transpiler unavailable — run this script with `bun pack.ts`", 2);
  return new bunGlobal.Bun.Transpiler({ loader: "ts" });
}

/** Read assets/app.ts and strip types so it can be inlined as plain browser JS. */
function transpileApp(appTsPath: string): string {
  try {
    return bunTranspiler().transformSync(read(appTsPath));
  } catch (e) {
    bail(`failed to transpile ${appTsPath}: ${e instanceof Error ? e.message : String(e)}`, 2);
  }
}

// Dynamic ESM import of the config file: the module specifier is chosen at
// runtime from CLI args (`--config PATH` / `--dir DIR`) and must load both
// legacy user `.mjs` configs and new `.ts` ones — a static import cannot
// express a caller-selected path.
const cfgMod: unknown = await import(pathToFileURL(cfgPath).href);
const config: PackConfig = parseConfig(defaultExportOf(cfgMod, cfgPath), cfgPath, outDir);

// ---- validate config (done in parseConfig) ----
const reports = config.reports;

// ---- load each report ----
const reportSrc = new Map<string, string>(); // key -> raw HTML
for (const r of reports) reportSrc.set(r.key, read(resolve(outDir, r.file)));

// ---- chunk CSS by SKILL theme convention (/* ---- header ---- */) ----
function chunkStyles(css: string): string[] {
  const re = /(^|\n)(\/\* ----[^*]*\*\/[\s\S]*?(?=\n\/\* ----|\s*$))/g;
  const out: string[] = [];
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    if (m.index > last) {
      const tail = css.slice(last, m.index).trim();
      if (tail) out.push(tail);
    }
    out.push(m[2].trim());
    last = m.index + m[0].length - (m[1] ? 1 : 0);
  }
  const tail = css.slice(last).trim();
  if (tail && tail !== "*/") out.push(tail);
  return out.filter(Boolean);
}
function extractStyleChunks(html: string): string[] {
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  return m ? chunkStyles(m[1]) : [];
}
function extractBody(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (!m) bail(`no <body> in source`, 3);
  return m[1];
}
function extractMetaDesc(html: string): string {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/);
  return m ? m[1] : "";
}
function extractTabKeys(html: string): Set<string> {
  const re = /<button\b[^>]*\bclass="[^"]*\btab\b[^"]*"[^>]*\bdata-tab="([^"]+)"/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[1]);
  return out;
}

// ---- collision detection ----
//   A. id collision:        any `id="X"` literal that appears in two or more reports.
//   B. tab-key collision:   a `data-tab="X"` value that appears in two or more reports.
// In both cases the FIRST report in config order keeps the bare identifier; every
// later report prefixes with `{key}-`. `main` is special-cased: if any report has
// `id="main"`, that id is ALWAYS renamed to `main-{key}` in EVERY report that has
// it (so there is never more than one visible skip-link target with the bare id).
const idCollisions: { id: string; keptIn: string; prefixedIn: string[] }[] = [];
const tabKeyCollisions: { key: string; keptIn: string; prefixedIn: string[] }[] = [];
const mainRenames: { key: string; from: string; to: string }[] = [];

function buildCollisionMap(): { idMap: Map<string, Map<string, string>>; tabKeyMap: Map<string, Map<string, string>> } {
  const idToReports = new Map<string, string[]>();
  const re = /\bid="([^"]+)"/g;
  // Reset state by recreating local regex (defensive — re.lastIndex = 0 is enough,
  // but the prior version had a dead-loop line; we just iterate cleanly).
  for (const r of reports) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(reportSrc.get(r.key) ?? "")) !== null) {
      if (!idToReports.has(m[1])) idToReports.set(m[1], []);
      idToReports.get(m[1])?.push(r.key);
    }
  }

  // tab keys per report
  const tabKeysByReport = new Map<string, Set<string>>();
  for (const r of reports) tabKeysByReport.set(r.key, extractTabKeys(reportSrc.get(r.key) ?? ""));
  const tabKeyToReports = new Map<string, string[]>();
  for (const [k, keys] of tabKeysByReport) {
    for (const tk of keys) {
      if (!tabKeyToReports.has(tk)) tabKeyToReports.set(tk, []);
      tabKeyToReports.get(tk)?.push(k);
    }
  }

  // First-by-config for ids + tab keys
  const firstById = new Map<string, string>();
  for (const r of reports) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(reportSrc.get(r.key) ?? "")) !== null) {
      if (!firstById.has(m[1])) firstById.set(m[1], r.key);
    }
  }
  const firstByTabKey = new Map<string, string>();
  for (const r of reports) {
    for (const tk of tabKeysByReport.get(r.key) ?? []) {
      if (!firstByTabKey.has(tk)) firstByTabKey.set(tk, r.key);
    }
  }

  // idMap[reportKey] -> Map(oldId -> newId)
  const idMap = new Map<string, Map<string, string>>();
  for (const r of reports) idMap.set(r.key, new Map());
  for (const [id, ks] of idToReports) {
    if (ks.length < 2) continue;
    const keptIn = firstById.get(id);
    const prefixedIn = ks.filter(k => k !== keptIn);
    if (!prefixedIn.length || keptIn === undefined) continue;
    idCollisions.push({ id, keptIn, prefixedIn });
    for (const k of prefixedIn) idMap.get(k)?.set(id, `${k}-${id}`);
  }

  // tabKeyMap[reportKey] -> Map(oldKey -> newKey)
  const tabKeyMap = new Map<string, Map<string, string>>();
  for (const r of reports) tabKeyMap.set(r.key, new Map());
  for (const [tk, ks] of tabKeyToReports) {
    if (ks.length < 2) continue;
    const keptIn = firstByTabKey.get(tk);
    const prefixedIn = ks.filter(k => k !== keptIn);
    if (!prefixedIn.length || keptIn === undefined) continue;
    tabKeyCollisions.push({ key: tk, keptIn, prefixedIn });
    for (const k of prefixedIn) {
      const newKey = `${k}-${tk}`;
      tabKeyMap.get(k)?.set(tk, newKey);
      // Related DOM ids (`tab-X`, `panel-X`) follow the rename so app.ts's
      // scoped lookup (root.querySelector("#panel-" + k)) still resolves.
      idMap.get(k)?.set(`tab-${tk}`, `tab-${k}-${tk}`);
      idMap.get(k)?.set(`panel-${tk}`, `panel-${k}-${tk}`);
    }
  }

  // ---- `main` special case ----
  // If exactly one report has `id="main"` it stays bare (no second copy = no
  // collision to rename against, but the rule still applies: rename it in
  // EVERY report that has it, including the lone one, so two visible skip-links
  // with bare `id="main"` cannot coexist if a third report is added later and
  // starts with `main`).
  //
  // The rule: for every report where `main` appears, schedule a rename to
  // `main-{key}`. Apply in idMap for that key.
  for (const r of reports) {
    if (idToReports.has("main")) {
      const reportsWithMain = idToReports.get("main") ?? [];
      if (reportsWithMain.includes(r.key)) {
        idMap.get(r.key)?.set("main", `main-${r.key}`);
        mainRenames.push({ key: r.key, from: "main", to: `main-${r.key}` });
      }
    }
  }

  return { idMap, tabKeyMap };
}

// ---- rewrite body for one report ----
//   1) id collisions: prefix every occurrence (id="…", href="#…", data-sec="…",
//      aria-controls="…", aria-labelledby="…").
//   2) tab-key collisions: prefix the *related* DOM ids only (`tab-X`, `panel-X`).
//      data-tab / data-toc values stay as semantic keys; app.ts looks everything
//      up scoped to the root via `root.querySelector("#panel-" + k)`, so the
//      rename is transparent at runtime.
//   3) cross-file href rewrite: ONLY for relative sibling filenames (no scheme,
//      no `//`, no leading `/`). The link target filename must be one of the
//      packed reports; if so, rewrite to `#doc-{KEY}` or `#frag`. The fragment
//      gets the other report's id/tab-key prefix applied too. Bare filename (no
//      fragment) becomes `#doc-{KEY}`.
//   4) `main` gets renamed in every report that has it (see `buildCollisionMap`).
//   5) strip inlined <script> and <style> at body level.
function isRelativeSibling(hrefFile: string, packedSet: Set<string>): boolean {
  if (!hrefFile) return false;
  if (isAbsolute(hrefFile)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(hrefFile)) return false; // has a scheme
  if (hrefFile.startsWith("//")) return false;             // protocol-relative
  const cleaned = hrefFile.replace(/^\.\//, "");
  const file = basename(cleaned);
  return packedSet.has(file);
}

type CollisionMaps = { idMap: Map<string, Map<string, string>>; tabKeyMap: Map<string, Map<string, string>> };

function rewriteBody(
  body: string,
  key: string,
  idMap: Map<string, Map<string, string>>,
  tabKeyMap: Map<string, Map<string, string>>,
  crossFileMap: Map<string, PackReport>,
): string {
  let html = body;

  // ---- 3) cross-file href rewrite (relative only) ----
  // Order matters: do this BEFORE step 1 — once we rewrite to "#frag", the
  // step-1 prefixing should not touch it again because the bare id is gone.
  const packedFileSet = new Set(crossFileMap.keys());
  const hrefRe = /\bhref="([^"]+)"/g;
  html = html.replace(hrefRe, (full: string, target: string): string => {
    const hashIdx = target.indexOf("#");
    const filePart = hashIdx === -1 ? target : target.slice(0, hashIdx);
    const fragPart = hashIdx === -1 ? "" : target.slice(hashIdx + 1);
    if (!filePart || !isRelativeSibling(filePart, packedFileSet)) return full;
    const report = crossFileMap.get(basename(filePart.replace(/^\.\//, "")));
    if (!report) return full;
    const newKey = report.key;
    let finalFrag = fragPart;
    if (fragPart) {
      const idm = idMap.get(newKey);
      const tkm = tabKeyMap.get(newKey);
      if (idm?.has(fragPart)) finalFrag = idm.get(fragPart) ?? fragPart;
      else if (tkm?.has(fragPart)) finalFrag = "panel-" + (tkm.get(fragPart) ?? fragPart);
    }
    if (finalFrag) return `href="#${finalFrag}"`;
    return `href="#doc-${newKey}"`;
  });

  // ---- 1) id-collision rewrites (apply longest first) ----
  const sortedIds = Array.from(idMap.get(key)?.entries() ?? []).sort((a, b) => b[0].length - a[0].length);
  for (const [oldId, newId] of sortedIds) {
    const escOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`\\bid="${escOld}"`, "g"), `id="${newId}"`);
    html = html.replace(new RegExp(`(href)="#${escOld}(?=["'\\s])`, "g"), `$1="#${newId}`);
    html = html.replace(new RegExp(`\\bdata-sec="${escOld}"`, "g"), `data-sec="${newId}"`);
    html = html.replace(new RegExp(`\\baria-(controls|labelledby)="${escOld}"`, "g"),
      (_: string, attr: string) => `aria-${attr}="${newId}"`);
  }

  // ---- 5) strip inlined <script> and <style> ----
  html = html.replace(/<script\b[\s\S]*?<\/script>/g, "");
  html = html.replace(/<style\b[\s\S]*?<\/style>/g, "");

  return html;
}

// ---- dedupe CSS chunks across reports (first occurrence wins) ----
const headStylesByKey = new Map<string, string[]>();
for (const r of reports) headStylesByKey.set(r.key, extractStyleChunks(reportSrc.get(r.key) ?? ""));
const seenChunks = new Set<string>();
const orderedUniqueChunks: { key: string; chunk: string }[] = [];
for (const r of reports) {
  for (const c of headStylesByKey.get(r.key) ?? []) {
    if (!seenChunks.has(c)) { seenChunks.add(c); orderedUniqueChunks.push({ key: r.key, chunk: c }); }
  }
}
const combinedCss = orderedUniqueChunks.map(x => x.chunk).join("\n\n")
  + "\n\n" + read(extraCssPath);

// ---- compute collision maps + cross-file map ----
const { idMap, tabKeyMap }: CollisionMaps = buildCollisionMap();
const crossFileMap = new Map<string, PackReport>();
for (const r of reports) crossFileMap.set(basename(r.file), r);

// ---- rewrite each report body ----
const bodies = new Map<string, string>();
for (const r of reports) {
  bodies.set(r.key, rewriteBody(
    extractBody(reportSrc.get(r.key) ?? ""),
    r.key,
    idMap, tabKeyMap,
    crossFileMap
  ));
}

// ---- head values ----
const firstTitleMatch = (reportSrc.get(reports[0].key) ?? "").match(/<title>([^<]*)<\/title>/);
const headTitle = firstTitleMatch ? firstTitleMatch[1] : reports[0].title;
const descs = reports.map(r => extractMetaDesc(reportSrc.get(r.key) ?? "")).filter(Boolean);
const headMetaDesc = descs[0] || "Self-contained reports pack.";

// ---- nav: build docbar switcher buttons ----
const navItems = reports.map(r => {
  const sel = r.key === reports[0].key ? "true" : "false";
  const tone = r.tone || "primary";
  return `<button class="dswitch" type="button" data-doc="${escHtml(r.key)}" data-title="${escAttr(r.title)}" data-tone="${escAttr(tone)}" aria-selected="${sel}"><span class="dot"></span>${escHtml(r.label)}</button>`;
}).join("\n    ");

// ---- assemble .docapp blocks ----
const appBlocks = reports.map(r => {
  const isFirst = r.key === reports[0].key;
  const tone = r.tone || "primary";
  return `<div class="docapp" data-doc="${escHtml(r.key)}" data-tone="${escAttr(tone)}" id="doc-${escHtml(r.key)}"${isFirst ? "" : " hidden"} data-default="${isFirst ? "true" : "false"}">\n\n${bodies.get(r.key) ?? ""}\n</div>`;
}).join("\n");

// ---- inline the browser runtime: transpile assets/app.ts to plain JS ----
const appJs = transpileApp(appTsPath);

const banner = "<!-- generated by pack-self-contained-html-reports — do not edit; add a report in pack.config.mjs and re-run the skill -->";

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(headTitle)}</title>
<meta name="description" content="${escAttr(headMetaDesc)}">
${banner}
<style>
${combinedCss}
</style>
</head>
<body>
${banner}
<nav class="docbar" aria-label="Reports">
  <div class="docbar-in">
    <span class="brand"><b>${escHtml(config.brand)}</b> reports</span>
    ${navItems}
    <span class="docnote">One file · no network · open in Chrome</span>
  </div>
</nav>
${appBlocks}
<script>
${appJs}
</script>
</body>
</html>
`;

const outPath = resolve(outDir, config.out);
writeFileSync(outPath, out, "utf8");

// ---- update index.html KB chip if present ----
let indexUpdated = false;
let indexKb: number | null = null;
if (config.index) {
  const indexPath = resolve(outDir, config.index);
  if (existsSync(indexPath)) {
    const idx = read(indexPath);
    const bytes = Buffer.byteLength(out, "utf8");
    const kb = Math.round(bytes / 1024);
    indexKb = kb;
    const m = idx.match(/<a class="rcard" href="[^"]*">[\s\S]*?<\/a>/);
    if (m) {
      const card = m[0];
      const updated = card.replace(/(<b[^>]*>)\d+(<\/b>\s*KB)/, `$1${kb}$2`);
      if (updated !== card) {
        writeFileSync(indexPath, idx.replace(card, updated), "utf8");
        indexUpdated = true;
      }
    }
  }
}

// ---- static checks ----
const errs: string[] = [];
const deadAnchors: string[] = [];
const leftoverHtmlHrefs: string[] = [];

if (/^\s*(?:import|export)[\s{]/m.test(appJs)) {
  errs.push("inlined app runtime is not plain script (import/export found after transpile)");
}

const idsSeen = new Map<string, number>();
const idRe = /\bid="([^"]+)"/g;
let im: RegExpExecArray | null;
while ((im = idRe.exec(out)) !== null) idsSeen.set(im[1], (idsSeen.get(im[1]) || 0) + 1);
const dupes = [...idsSeen.entries()].filter(([, n]) => n > 1);
if (dupes.length) errs.push(`duplicate ids in output: ${dupes.map(([i, n]) => `${i}x${n}`).join(", ")}`);

const packedFiles = new Set(reports.map(r => r.file).concat([config.out]));
const hrefLeftoverRe = /\bhref="([^"]+)"/g;
let hm: RegExpExecArray | null;
while ((hm = hrefLeftoverRe.exec(out)) !== null) {
  const target = hm[1];
  const hashIdx = target.indexOf("#");
  const filePart = hashIdx === -1 ? target : target.slice(0, hashIdx);
  if (!filePart) continue;
  if (!isRelativeSibling(filePart, packedFiles)) continue;
  if (packedFiles.has(basename(filePart.replace(/^\.\//, "")))) {
    leftoverHtmlHrefs.push(hm[0]);
  }
}
if (leftoverHtmlHrefs.length) errs.push(`leftover hrefs to packed filenames: ${Array.from(new Set(leftoverHtmlHrefs)).slice(0, 8).join(", ")}`);

if (/<script\s+src=/i.test(out)) errs.push("found <script src=...>");
if (/<link\s+rel=["']?stylesheet/i.test(out)) errs.push("found <link rel=stylesheet>");
if (/\bfetch\s*\(/i.test(out)) errs.push("found fetch() call");

for (const r of reports) {
  const escKey = r.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const have1 = new RegExp(`class="docapp"[^>]*data-doc="${escKey}"`).test(out);
  const have2 = new RegExp(`class="dswitch"[^>]*data-doc="${escKey}"`).test(out);
  if (!have1) errs.push(`no .docapp[data-doc="${r.key}"]`);
  if (!have2) errs.push(`no .dswitch[data-doc="${r.key}"]`);
}

const hashHrefRe = /\bhref="#([^"]*)"/g;
const idSet = new Set(idsSeen.keys());
let am: RegExpExecArray | null;
while ((am = hashHrefRe.exec(out)) !== null) {
  const target = am[1];
  if (target === "") continue;
  if (!idSet.has(target)) deadAnchors.push(am[0]);
}
if (deadAnchors.length) errs.push(`dead anchors: ${Array.from(new Set(deadAnchors)).slice(0, 8).join(", ")}${deadAnchors.length > 8 ? ` (+${deadAnchors.length - 8} more)` : ""}`);

const bytes = Buffer.byteLength(out, "utf8");
const summary = {
  out: config.out,
  bytes,
  kb: Math.round(bytes / 1024),
  reports: reports.map(r => r.key),
  idCollisions,
  tabKeyCollisions,
  mainRenames,
  collisionCount: idCollisions.length + tabKeyCollisions.length,
  indexUpdated,
  indexKb,
  deadAnchorCount: new Set(deadAnchors).size,
  leftoverHtmlHrefs: leftoverHtmlHrefs.length,
  errors: errs,
};

if (errs.length) {
  console.log(JSON.stringify(summary, null, 2));
  bail(`static checks failed: ${errs.length}`, 4);
} else {
  console.log(JSON.stringify(summary, null, 2));
}

function escHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c] ?? c);
}
function escAttr(s: string): string { return escHtml(s); }
