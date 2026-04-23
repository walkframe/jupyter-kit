import { expect, test } from '@playwright/test';

const storyUrl = (id: string) => `/iframe.html?id=${id}&viewMode=story`;

/**
 * Security regression suite. `security-xss--attacks` mounts a notebook
 * whose markdown / outputs include:
 *   - `<script>` tags (inline, inside `<svg>`, inside `image/svg+xml` mime)
 *   - `<img src=x onerror="…">`
 *   - `<iframe srcdoc="…">` with a script inside
 *   - `<a href="javascript:…">`
 *
 * All payloads set window / document properties we can detect. If the
 * sanitizer is working, none of them fire and all probes stay undefined.
 */
test.describe('security: XSS payloads do not execute', () => {
  test('no payload writes to window or changes document.title', async ({ page }) => {
    // Fail fast if any loaded script errors — an executed attack might crash.
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(storyUrl('security-xss--attacks'));

    // Wait for the notebook body to mount so the payloads have had a
    // chance to try to execute.
    await expect(page.locator('.jknb-root .cell').first()).toBeVisible({ timeout: 10_000 });

    // Probe every `window.__xss*` flag the fixture would set if a payload ran.
    const flags = await page.evaluate(() => {
      const keys = [
        '__xssMarkdown',
        '__xssImgOnerror',
        '__xssSvgScript',
        '__xssJsHref',
        '__xssIframe',
        '__xssCodeSrc',
        '__xssStreamScript',
        '__xssHtmlOutputScript',
        '__xssHtmlOutputImg',
        '__xssHtmlOutputIframe',
        '__xssSvgMimeScript',
        '__xssSvgAnchor',
      ];
      const hits: Record<string, unknown> = {};
      for (const k of keys) {
        const v = (window as unknown as Record<string, unknown>)[k];
        if (v !== undefined) hits[k] = v;
      }
      return hits;
    });
    expect(flags).toEqual({});

    // `document.title` is a canonical side-effect target for `<script>` that
    // does get evaluated. The fixture's payloads would set it to `pwned-…` on
    // success — assert it doesn't start with that.
    const title = await page.title();
    expect(title.startsWith('pwned-')).toBe(false);

    // No script evaluation errors should have surfaced either.
    expect(pageErrors).toEqual([]);

    // The sanitizer should strip `<script>` tags entirely from the rendered DOM.
    const scriptCountInside = await page.locator('.jknb-root script').count();
    expect(scriptCountInside).toBe(0);

    // `javascript:` href must be neutralised (rehype-sanitize drops the
    // whole href; DOMPurify replaces it with `#`). Either way, no anchor
    // inside the notebook should point at a `javascript:` URL.
    const jsHrefs = await page.locator('.jknb-root a[href^="javascript:"]').count();
    expect(jsHrefs).toBe(0);
  });
});
