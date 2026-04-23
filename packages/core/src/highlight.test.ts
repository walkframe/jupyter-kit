import { describe, it, expect } from 'vitest';

import { highlight, highlightWithParser } from './highlight';
import { python } from './langs/python';

describe('highlight', () => {
  it('wraps Python keywords in class spans', () => {
    const html = highlight(python, 'def f(x):\n    return x + 1\n');
    expect(html).toContain('<span class="');
    expect(html).toContain('def');
    expect(html).toContain('return');
  });

  it('escapes HTML-significant characters', () => {
    const html = highlightWithParser(python.parser, 'x = "<script>"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('preserves line breaks as \\n', () => {
    const html = highlight(python, 'a = 1\nb = 2\n');
    expect(html).toContain('\n');
  });
});
