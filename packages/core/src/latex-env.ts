import type { Transformer } from 'unified';
import type { Node } from 'unist';
import { visit } from 'unist-util-visit';

type TextNode = {
  value: string;
  type: string;
  data?: unknown;
};

/**
 * Convert standalone `\begin{env} ... \end{env}` paragraphs into math nodes so
 * that remark-math downstream plugins (mathjax/katex) pick them up.
 */
export const remarkLatexEnvironment: () => Transformer = () => {
  const transformer: Transformer = (tree: Node) => {
    visit(tree, 'paragraph', (node) => {
      visit(node, 'text', (textNode: TextNode) => {
        if (
          textNode.value.match(/^\s*\\begin\{[a-z]+\}/m) &&
          textNode.value.match(/\\end\{[a-z]+\}\s*$/m)
        ) {
          textNode.type = 'math';
          textNode.value = textNode.value.replace(/\\\s*$/gm, '\\\\\\');
          textNode.data = {
            hChildren: [{ type: 'text', value: textNode.value }],
            hName: 'div',
            hProperties: { className: ['math', 'math-inline'] },
          };
        }
      });
    });
    return tree;
  };
  return transformer;
};
