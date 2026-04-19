import type { Plugin } from '@jupyter-kit/core';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax/svg';
import type { Options as RemarkMathOptions } from 'remark-math';
import type { Options as MathJaxOptions } from 'rehype-mathjax';

export type MathjaxPluginOptions = {
  remarkMathOptions?: RemarkMathOptions;
  mathjaxOptions?: MathJaxOptions;
};

/**
 * Bundled MathJax SVG renderer for ipynb markdown cells. Math is converted
 * during the unified markdown pass — no DOM-time work, no external script tag.
 *
 * For CDN-loaded MathJax (smaller bundle, scripted reflow), use
 * `@jupyter-kit/mathjax-cdn` instead.
 */
export function createMathjaxPlugin(opts: MathjaxPluginOptions = {}): Plugin {
  return {
    name: '@jupyter-kit/mathjax',
    remarkPlugins: [[remarkMath, opts.remarkMathOptions ?? {}]],
    rehypePlugins: [[rehypeMathjax, opts.mathjaxOptions ?? {}]],
  };
}
