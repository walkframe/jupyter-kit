import type { PluggableList } from 'unified';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';

import { remarkLatexEnvironment } from './latex-env';

export type MarkdownPipelineOptions = {
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
};

/**
 * Build the shared unified processor.
 *
 * Plugin-supplied remark plugins run before remark-rehype so remark-math
 * (added by mathjax/katex plugins) can tokenise `$...$` before any
 * transformation. Plugin-supplied rehype plugins run before rehype-raw so they
 * can rewrite math nodes into MathML/SVG before raw HTML is reparsed.
 */
/**
 * The unified pipeline produces strings (it ends with rehype-stringify), so
 * downstream consumers only need a `process(text)` method. Modelling it
 * minimally avoids leaking the heavy generic shape across module boundaries.
 */
export type MarkdownProcessor = {
  process(text: string): Promise<{ toString(): string }>;
};

export function buildMarkdownProcessor(
  options: MarkdownPipelineOptions = {},
): MarkdownProcessor {
  const { remarkPlugins = [], rehypePlugins = [] } = options;

  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkLatexEnvironment)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypePlugins)
    .use(rehypeRaw)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

export async function renderMarkdown(
  processor: MarkdownProcessor,
  text: string,
): Promise<string> {
  const file = await processor.process(text);
  return String(file);
}
