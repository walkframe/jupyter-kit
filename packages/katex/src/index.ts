import type { Plugin } from '@jupyter-kit/core';
import { remarkPromoteDisplayMath } from '@jupyter-kit/core';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Options as RemarkMathOptions } from 'remark-math';
import type { KatexOptions } from 'katex';

export type KatexPluginOptions = {
  remarkMathOptions?: RemarkMathOptions;
  katexOptions?: KatexOptions;
};

/**
 * Bundled KaTeX renderer for ipynb markdown cells. Rewrites `\begin{eqnarray}`
 * (which KaTeX does not support) to `\begin{aligned}` before parsing.
 *
 * Remember to import the KaTeX stylesheet once in your app:
 *   import 'katex/dist/katex.min.css';
 *
 * For CDN-loaded KaTeX, use `@jupyter-kit/katex-cdn` instead.
 */
export function createKatexPlugin(opts: KatexPluginOptions = {}): Plugin {
  return {
    name: '@jupyter-kit/katex',
    remarkPlugins: [
      preprocessEqnarray,
      [remarkMath, opts.remarkMathOptions ?? {}],
      remarkPromoteDisplayMath,
    ],
    rehypePlugins: [[rehypeKatex, opts.katexOptions ?? {}]],
  };
}

/** Replace `\begin{eqnarray}...\end{eqnarray}` with `\begin{aligned}...\end{aligned}`. */
function preprocessEqnarray() {
  return (tree: unknown) => {
    visit(tree as Node, (node: Node) => {
      if ('value' in node && typeof (node as TextLike).value === 'string') {
        const tn = node as TextLike;
        tn.value = tn.value
          .replace(/\\begin\{eqnarray\}/g, '\\begin{aligned}')
          .replace(/\\end\{eqnarray\}/g, '\\end{aligned}');
      }
    });
  };
}

type Node = { type: string; children?: Node[] };
type TextLike = Node & { value: string };

function visit(node: Node, fn: (n: Node) => void): void {
  fn(node);
  if (node.children) {
    for (const c of node.children) visit(c, fn);
  }
}
