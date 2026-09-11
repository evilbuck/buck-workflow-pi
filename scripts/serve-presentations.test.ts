import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bannerLines,
  firstEntryFile,
  handleRequest,
  helpLines,
  listPresentations,
  main,
  parseArgs,
  reachableHosts,
  resolveRequestPath,
} from "./serve-presentations.js";

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "serve-presentations-"));
  mkdirSync(join(root, "alpha", "assets"), { recursive: true });
  writeFileSync(join(root, "alpha", "index.html"), "<h1>alpha</h1>");
  writeFileSync(join(root, "alpha", "blueprint.html"), "<h1>alpha blueprint</h1>");
  writeFileSync(join(root, "alpha", "assets", "styles.css"), "body{}");

  mkdirSync(join(root, "beta"), { recursive: true });
  writeFileSync(join(root, "beta", "blueprint.html"), "<h1>beta</h1>");

  mkdirSync(join(root, "not-a-package"), { recursive: true });
  writeFileSync(join(root, "not-a-package", "notes.md"), "no html here");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("resolveRequestPath", () => {
  it("keeps paths inside the served root", () => {
    expect(resolveRequestPath(root, "/alpha/index.html")).toBe(join(resolve(root), "alpha", "index.html"));
  });

  it("clamps absolute traversal back inside the root, encoded or not", () => {
    const inside = join(resolve(root), "package.json");
    expect(resolveRequestPath(root, "/../package.json")).toBe(inside);
    expect(resolveRequestPath(root, "/alpha/../../package.json")).toBe(inside);
    expect(resolveRequestPath(root, "/%2e%2e%2f%2e%2e%2fpackage.json")).toBe(inside);
  });

  it("rejects a relative path that would escape the root", () => {
    expect(resolveRequestPath(root, "../package.json")).toBeNull();
    expect(resolveRequestPath(root, "alpha/../../package.json")).toBeNull();
  });

  it("rejects a symlinked path that resolves outside the root", () => {
    const outside = mkdtempSync(join(tmpdir(), "serve-presentations-secret-"));
    writeFileSync(join(outside, "private.txt"), "secret");
    symlinkSync(join(outside, "private.txt"), join(root, "leak"));
    try {
      expect(resolveRequestPath(root, "/leak")).toBeNull();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects undecodable and null-byte paths", () => {
    expect(resolveRequestPath(root, "/%E0%A4%A")).toBeNull();
    expect(resolveRequestPath(root, "/alpha%00.html")).toBeNull();
  });
});

describe("firstEntryFile", () => {
  it("prefers index.html over blueprint.html", () => {
    expect(firstEntryFile(join(root, "alpha"))).toBe("index.html");
  });

  it("falls back to blueprint.html when b-blueprint wrote the package", () => {
    expect(firstEntryFile(join(root, "beta"))).toBe("blueprint.html");
  });

  it("returns null for a directory with no html", () => {
    expect(firstEntryFile(join(root, "not-a-package"))).toBeNull();
  });
});

describe("listPresentations", () => {
  it("lists only directories with an entry file", () => {
    expect(listPresentations(root).map((p) => p.slug).sort()).toEqual(["alpha", "beta"]);
  });

  it("returns nothing instead of throwing when the directory does not exist", () => {
    expect(listPresentations(join(root, "no-such-dir"))).toEqual([]);
  });
});

describe("handleRequest", () => {
  const get = (path: string) => handleRequest(new URL(`http://x${path}`), root);

  it("serves the index with links to each package", async () => {
    const res = get("/");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('href="/alpha/"');
    expect(body).toContain('href="/beta/"');
    expect(body).not.toContain("not-a-package");
  });

  it("redirects a bare package path so relative assets resolve", () => {
    const res = get("/alpha");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/alpha/");
  });

  it("serves the entry file for a package directory", async () => {
    const res = get("/alpha/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<h1>alpha</h1>");
  });

  it("serves nested assets with the right content type", async () => {
    const res = get("/alpha/assets/styles.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
  });

  it("never serves a file from outside the root", async () => {
    for (const attempt of ["/../package.json", "/alpha/../../package.json", "/%2e%2e%2fpackage.json"]) {
      const res = get(attempt);
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain("buck-workflow");
    }
  });

  it("404s unknown paths and directories with no entry file", () => {
    expect(get("/alpha/missing.html").status).toBe(404);
    expect(get("/not-a-package/").status).toBe(404);
  });
});

describe("parseArgs", () => {
  it("defaults to presentations on 0.0.0.0:4321", () => {
    expect(parseArgs([], {})).toEqual({ root: "presentations", port: 4321, host: "0.0.0.0", help: false });
  });

  it("reads PORT/HOST/PRESENTATIONS_DIR from the environment", () => {
    const opts = parseArgs([], { PORT: "8080", HOST: "127.0.0.1", PRESENTATIONS_DIR: "out" });
    expect(opts).toMatchObject({ port: 8080, host: "127.0.0.1", root: "out" });
  });

  it("lets flags win over the environment", () => {
    const opts = parseArgs(["--port", "9000", "--host", "127.0.0.1"], { PORT: "8080" });
    expect(opts).toMatchObject({ port: 9000, host: "127.0.0.1" });
  });

  it("accepts a positional directory", () => {
    expect(parseArgs(["dist/decks"], {}).root).toBe("dist/decks");
  });
});

describe("reachableHosts", () => {
  it("reports only the bind address when it is not a wildcard", () => {
    expect(reachableHosts("127.0.0.1")).toEqual([{ label: "bound", host: "127.0.0.1" }]);
  });

  it("labels tailnet addresses separately from lan when bound to the wildcard", () => {
    const hosts = reachableHosts("0.0.0.0");
    expect(hosts[0]).toEqual({ label: "local", host: "127.0.0.1" });
    for (const entry of hosts.slice(1)) {
      const expected = entry.host.startsWith("100.") ? ["tailscale", "lan"] : ["lan"];
      expect(expected).toContain(entry.label);
    }
  });
});

describe("bannerLines", () => {
  it("prints every reachable URL plus the exposure warning on a wildcard bind", () => {
    const out = bannerLines("/srv/presentations", "0.0.0.0", 4321, 2).join("\n");
    expect(out).toContain("2 packages");
    expect(out).toContain("local     http://127.0.0.1:4321/");
    expect(out).toContain("bound to 0.0.0.0");
    expect(out).toContain("ssh -L 4321:localhost:4321");
  });

  it("omits the exposure warning when bound to loopback", () => {
    const out = bannerLines("/srv/presentations", "127.0.0.1", 8080, 1).join("\n");
    expect(out).toContain("1 package\n");
    expect(out).toContain("bound     http://127.0.0.1:8080/");
    expect(out).not.toContain("bound to");
    expect(out).not.toContain("ssh -L");
  });
});

describe("helpLines", () => {
  it("documents every flag the parser accepts", () => {
    const out = helpLines().join("\n");
    for (const flag of ["--port", "--host", "--dir", "--help"]) expect(out).toContain(flag);
  });
});

describe("main", () => {
  it("prints usage and never reaches the listener on --help", () => {
    const logged: string[] = [];
    const original = console.log;
    console.log = (line: string) => void logged.push(line);
    try {
      // Bun.serve is undefined under vitest, so reaching the listener would throw.
      expect(() => main(["--help"])).not.toThrow();
    } finally {
      console.log = original;
    }
    expect(logged.join("\n")).toContain("Usage:");
  });
});
