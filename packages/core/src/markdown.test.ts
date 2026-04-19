import { describe, it, expect } from 'vitest';

import { buildMarkdownProcessor, renderMarkdown } from './markdown';

describe('markdown pipeline', () => {
  it('renders basic markdown to HTML', async () => {
    const html = await renderMarkdown(
      buildMarkdownProcessor(),
      '# Hello\n\nHello **world**.',
    );
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<strong>world</strong>');
  });

  it('handles GFM tables', async () => {
    const html = await renderMarkdown(
      buildMarkdownProcessor(),
      '| a | b |\n|---|---|\n| 1 | 2 |\n',
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });

  it('passes raw HTML through rehype-raw', async () => {
    const html = await renderMarkdown(
      buildMarkdownProcessor(),
      '<div class="hand-written">raw</div>',
    );
    expect(html).toContain('class="hand-written"');
  });

  it('converts LaTeX environments to math nodes', async () => {
    const html = await renderMarkdown(
      buildMarkdownProcessor(),
      '\\begin{align}\nx &= 1\n\\end{align}',
    );
    expect(html).toContain('math');
    expect(html).toContain('\\begin{align}');
  });
});
