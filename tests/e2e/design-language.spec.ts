/**
 * Browser verification for the shared HTML design language.
 *
 * The vitest guard (skills/_shared/scripts/design-language.test.ts) proves the
 * token text matches the brief. This proves the tokens are actually *wired into
 * the rendered page* and that the layout survives narrow viewports — neither of
 * which a text comparison can see.
 *
 * Local only; CI runs `npm test` (vitest + bun), not Playwright.
 *   npx playwright test tests/e2e/design-language.spec.ts --project=chromium
 */
import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const TEMPLATE = pathToFileURL(join(ROOT, "skills/b-blueprint/references/blueprint-template.html")).href;

const brief = JSON.parse(
  readFileSync(join(ROOT, "skills/_shared/design-brief.jsonc"), "utf8")
    .split("\n")
    .map((line) => line.replace(/(^|\s)\/\/(?![^"]*").*$/, ""))
    .join("\n"),
);
const surface = brief.token_groups.find((g: { group: string }) => g.group === "surface").tokens;

test.describe("blueprint template renders the shared design language", () => {
  test("paints the token palette, not a stylesheet default", async ({ page }) => {
    await page.goto(TEMPLATE);
    // #f7f6f3 — the warm ground. A dropped or unparsed token block yields white.
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 246, 243)");
    expect(surface["--bg"]).toBe("#f7f6f3");
    await expect(page.locator("section#architecture")).toBeVisible();
  });

  test.describe("no horizontal overflow", () => {
    for (const width of [390, 768, 1280]) {
      test(`at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(TEMPLATE);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });

  test("mermaid renders both diagrams with the light theme and no parse errors", async ({ page }) => {
    await page.goto(TEMPLATE);
    await expect(page.locator(".mermaid svg")).toHaveCount(2);
    await expect(page.locator(".mermaid svg g.error-icon")).toHaveCount(0);
    const rendered = (await page.locator(".mermaid").allTextContents()).join("\n");
    expect(rendered).not.toMatch(/syntax error|parse error|mermaid version/i);
  });

  test("collapses the rail into a tap-to-open card on narrow viewports", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(TEMPLATE);
    const toggle = page.locator(".toctoggle");
    await expect(toggle).toBeVisible();
    await expect(page.locator("#toc nav")).toBeHidden();
    await toggle.click();
    await expect(page.locator("#toc nav")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
