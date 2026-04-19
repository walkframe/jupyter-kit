import { expect, test } from '@playwright/test';

const storyUrl = (id: string) => `/iframe.html?id=${id}&viewMode=story`;

test.describe('smoke: core renders', () => {
  test('basic story mounts with jknb-root root', async ({ page }) => {
    await page.goto(storyUrl('basic--default'));
    const root = page.locator('.jknb-root').first();
    await expect(root).toBeVisible();
  });

  test('showcase readonly renders multiple cells', async ({ page }) => {
    await page.goto(storyUrl('showcase--read-only'));
    const cells = page.locator('.jknb-root .cell');
    await expect(cells.first()).toBeVisible();
    expect(await cells.count()).toBeGreaterThan(1);
  });

  test('syntax highlight applies classed spans', async ({ page }) => {
    await page.goto(storyUrl('highlight-lezer-python--one-dark'));
    const tokens = page.locator('.jknb-root pre span[class^="tok-"]');
    await expect(tokens.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('math plugins', () => {
  test('KaTeX produces .katex output', async ({ page }) => {
    await page.goto(storyUrl('math-katex--bundled'));
    await expect(page.locator('.katex').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('MathJax produces mjx-container output', async ({ page }) => {
    await page.goto(storyUrl('math-mathjax--bundled'));
    await expect(page.locator('mjx-container').first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('themes', () => {
  const themes = [
    'themes-notebook-chrome--default',
    'themes-notebook-chrome--dark',
    'themes-notebook-chrome--monokai',
    'themes-notebook-chrome--solarized-light',
  ];
  for (const id of themes) {
    test(`${id} mounts without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(storyUrl(id));
      await expect(page.locator('.jknb-root').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

test.describe('editor (readonly)', () => {
  test('read-only story hides toolbar play button', async ({ page }) => {
    await page.goto(storyUrl('editor-codemirror--read-only'));
    await expect(page.locator('.jknb-root').first()).toBeVisible();
    // Read-only cells must not expose the Run/▶ toolbar button.
    await expect(page.locator('.jknb-root button[aria-label*="Run" i]')).toHaveCount(0);
  });
});
