import type { Transformer } from 'unified';
import type { Node } from 'unist';
import { visit } from 'unist-util-visit';

type InlineMathNode = {
  type: string;
  value?: string;
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
  data?: {
    hName?: string;
    hProperties?: { className?: string[] };
    hChildren?: unknown;
  };
};

/**
 * remark-math 6.x classifies single-line `$$...$$` as `inlineMath`, so the
 * user's display-vs-inline intent is lost by the time downstream consumers
 * (rehype-katex, our unwrap-to-text pipelines, MathJax) see the tree.
 *
 * The Jupyter / Pandoc convention is `$$...$$` = display regardless of
 * whether it spans multiple lines. Recover that intent by comparing the
 * source span (from `position`) to the inner value length: `$..$` adds 2
 * chars of delimiters, `$$..$$` adds 4. The mdast node type is left as
 * `inlineMath` (so the surrounding paragraph stays valid phrasing), but
 * the `hProperties.className` is rewritten to `math-display` so rehype-
 * katex / our unwrap pipelines treat it as display.
 *
 * Safe on already-multi-line `$$\n..\n$$` block math (those are `math`
 * nodes, not `inlineMath`, so the visitor skips them).
 */
export const remarkPromoteDisplayMath: () => Transformer = () => {
  const transformer: Transformer = (tree: Node) => {
    visit(tree, 'inlineMath', (node: InlineMathNode) => {
      const text = node.value ?? '';
      const start = node.position?.start?.offset;
      const end = node.position?.end?.offset;
      if (typeof start !== 'number' || typeof end !== 'number') return;
      const span = end - start;
      // `$$..$$` source: 4 delimiter chars. `$..$`: 2. Anything else: skip.
      if (span !== text.length + 4) return;
      // Keep type as `inlineMath` to preserve phrasing-content invariants,
      // only override the hast-side className.
      node.data = {
        ...(node.data ?? {}),
        hName: 'code',
        hProperties: { className: ['language-math', 'math-display'] },
        hChildren: [{ type: 'text', value: text }],
      };
    });
    return tree;
  };
  return transformer;
};
