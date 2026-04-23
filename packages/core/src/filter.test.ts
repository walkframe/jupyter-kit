import { describe, it, expect } from 'vitest';

import { defaultHtmlFilter } from './filter';

describe('defaultHtmlFilter', () => {
  it('strips <script> tags', () => {
    const out = defaultHtmlFilter('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain('<p>hi</p>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert');
  });

  it('strips inline event handlers', () => {
    const out = defaultHtmlFilter('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  it('rejects javascript: URLs', () => {
    const out = defaultHtmlFilter('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('preserves <use> with xlink:href for MathJax SVG', () => {
    const svg =
      '<svg><use xlink:href="#MJX-1"/></svg>';
    const out = defaultHtmlFilter(svg);
    expect(out).toContain('<use');
    expect(out.toLowerCase()).toContain('xlink:href="#mjx-1"');
  });

  it('keeps <mjx-container> custom elements', () => {
    const out = defaultHtmlFilter(
      '<mjx-container jax="SVG" display="true">x</mjx-container>',
    );
    expect(out).toContain('<mjx-container');
    expect(out).toContain('jax="SVG"');
    expect(out).toContain('display="true"');
  });
});
