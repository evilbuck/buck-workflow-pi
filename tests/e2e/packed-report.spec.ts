import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Exercises the actual packer and its inlined runtime over file://, without a server.
// Run: bunx --bun playwright test tests/e2e/packed-report.spec.ts --project=chromium
// Requires Bun, @playwright/test and the Playwright Chromium browser.
const packer = resolve('skills/pack-self-contained-html-reports/scripts/pack.ts');

function report(name: string, other: string) {
  return `<!doctype html><html><head><title>${name}</title></head><body>
    <nav>
      <button class="tab" id="tab-ov" data-tab="ov" aria-controls="panel-ov">Overview</button>
      <button class="tab" id="tab-${name}-detail" data-tab="${name}-detail" aria-controls="panel-${name}-detail">Details</button>
    </nav>
    <aside class="tocnav">
      <div class="tocgroup" data-toc="ov"><a data-sec="${name}-intro" href="#${name}-intro">Intro</a></div>
      <div class="tocgroup" data-toc="${name}-detail"><a data-sec="${name}-target" href="#${name}-target">Target</a></div>
    </aside>
    <main>
      <section role="tabpanel" id="panel-ov" aria-labelledby="tab-ov"><h2 id="${name}-intro">${name} intro</h2><a href="${other}.html#${other}-target">Go to ${other} target</a></section>
      <section role="tabpanel" id="panel-${name}-detail" aria-labelledby="tab-${name}-detail"><h2 id="${name}-target">${name} target</h2></section>
    </main>
  </body></html>`;
}

let dir: string;
let url: string;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'packed-browser-'));
  writeFileSync(join(dir, 'alpha.html'), report('alpha', 'beta'));
  writeFileSync(join(dir, 'beta.html'), report('beta', 'alpha'));
  writeFileSync(join(dir, 'pack.config.mjs'), `export default ${JSON.stringify({
    out: 'packed.html', brand: 'Browser test', reports: [
      { key: 'alpha', file: 'alpha.html', label: 'Alpha', title: 'Alpha report' },
      { key: 'beta', file: 'beta.html', label: 'Beta', title: 'Beta report' },
    ],
  })};`);
  const result = spawnSync('bun', [packer, '--dir', dir], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`pack failed: ${result.error ?? result.stderr}\n${result.stdout}`);
  url = pathToFileURL(join(dir, 'packed.html')).href;
});

test.afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test('switches reports, keeps their tab state, and updates accessible state and title', async ({ page }) => {
  await page.goto(url);
  const alpha = page.locator('.docapp[data-doc="alpha"]');
  const beta = page.locator('.docapp[data-doc="beta"]');
  const alphaSwitch = page.locator('.dswitch[data-doc="alpha"]');
  const betaSwitch = page.locator('.dswitch[data-doc="beta"]');
  await expect(alpha).toBeVisible();
  await expect(beta).toBeHidden();
  await expect(alphaSwitch).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveTitle('Alpha report');

  await alpha.getByRole('button', { name: 'Details' }).click();
  await expect(alpha.locator('#alpha-target')).toBeVisible();
  await expect(alpha.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  await expect(alpha.locator('[data-toc="ov"]')).toBeHidden();
  await expect(alpha.locator('[data-toc="alpha-detail"]')).toBeVisible();
  await expect(page).toHaveURL(/#alpha-detail$/);

  await betaSwitch.click();
  await expect(alpha).toBeHidden();
  await expect(beta.locator('#beta-intro')).toBeVisible();
  await expect(betaSwitch).toHaveAttribute('aria-selected', 'true');
  await expect(alphaSwitch).toHaveAttribute('aria-selected', 'false');
  await expect(page).toHaveTitle('Beta report');
  await expect(page).toHaveURL(/#doc-beta$/);
  await alphaSwitch.click();
  await expect(alpha.locator('#alpha-target')).toBeVisible();
  await expect(page).toHaveURL(/#doc-alpha$/);
});

test('routes packed sibling links and startup and subsequent hashes to the owning report and tab', async ({ page }) => {
  await page.goto(`${url}#beta-target`);
  const alpha = page.locator('.docapp[data-doc="alpha"]');
  const beta = page.locator('.docapp[data-doc="beta"]');
  await expect(beta.locator('#beta-target')).toBeVisible();
  await expect(alpha).toBeHidden();
  await expect(beta.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveTitle('Beta report');

  await page.evaluate(() => { location.hash = '#doc-alpha'; });
  await expect(alpha.locator('#alpha-intro')).toBeVisible();
  await expect(beta).toBeHidden();
  await alpha.getByRole('link', { name: 'Go to beta target' }).click();
  await expect(beta.locator('#beta-target')).toBeVisible();
  await expect(alpha).toBeHidden();
  await expect(page).toHaveURL(/#beta-target$/);
  await expect(page).toHaveTitle('Beta report');

  await page.evaluate(() => { location.hash = '#alpha-detail'; });
  await expect(alpha.locator('#alpha-target')).toBeVisible();
  await expect(beta).toBeHidden();
  await expect(alpha.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
});

test('keyboard tab navigation stays scoped to the active report despite colliding tab keys', async ({ page }) => {
  await page.goto(`${url}#doc-beta`);
  const beta = page.locator('.docapp[data-doc="beta"]');
  const overview = beta.getByRole('button', { name: 'Overview' });
  const details = beta.getByRole('button', { name: 'Details' });
  await expect(beta.locator('#beta-intro')).toBeVisible();
  await overview.focus();
  await page.keyboard.press('ArrowRight');
  await expect(details).toBeFocused();
  await expect(details).toHaveAttribute('aria-selected', 'true');
  await expect(beta.locator('#beta-target')).toBeVisible();
  await expect(beta.locator('#beta-intro')).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(overview).toBeFocused();
  await expect(beta.locator('#beta-intro')).toBeVisible();
});
